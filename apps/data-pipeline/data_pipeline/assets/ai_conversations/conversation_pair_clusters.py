from math import ceil
from typing import Optional

import faiss
import numpy as np
import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    AssetOut,
    multi_asset,
)
from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import normalize

from data_pipeline.assets.ai_conversations.utils.data_loading import (
    get_materialized_partitions,
    load_user_dataframe,
)
from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.partitions import user_partitions_def


class ConversationPairClustersConfig(RowLimitConfig):
    # Number of top similar users to consider
    top_k_users: int = 10
    # Maximum number of items allowed per cluster
    max_items_per_cluster: Optional[int] = 500

    cosine_difference: Optional[float] = None
    # Maximum number of iterations to try to find a good number of clusters
    max_cluster_iterations: int = 5


# Define schema once to avoid repetition
CONVERSATION_PAIR_SCHEMA = {
    "user_id": pl.Utf8,
    "match_group_id": pl.UInt32,
    "row_idx": pl.UInt32,
    "conversation_id": pl.Utf8,
    "title": pl.Utf8,
    "summary": pl.Utf8,
    "start_date": pl.Utf8,
    "start_time": pl.Utf8,
    "cluster_id": pl.UInt8,
}


def create_empty_result():
    """Create an empty result DataFrame with the correct schema."""
    return pl.DataFrame(schema=CONVERSATION_PAIR_SCHEMA)


def get_conversation_data(df, row_idx):
    """Extract conversation data from DataFrame at the given row index."""
    return (
        df.filter(pl.col("row_idx") == row_idx)
        .select(
            "row_idx",
            "conversation_id",
            "title",
            "summary",
            "start_date",
            "start_time",
        )
        .row(0, named=True)
    )


def calculate_user_average_embedding(embeddings: list[np.ndarray]) -> np.ndarray:
    """Calculate the average embedding vector for a user."""
    if isinstance(embeddings, list) and len(embeddings) == 0:
        return np.array([])
    # Handle case where embeddings might be a numpy array already
    if isinstance(embeddings, np.ndarray) and embeddings.size == 0:
        return np.array([])

    stacked = np.vstack(embeddings)
    return np.mean(stacked, axis=0)


def find_top_k_users(
    current_user_embedding: np.ndarray,
    user_embeddings: dict[str, np.ndarray],
    top_k: int,
) -> list[tuple[str, float]]:
    """
    Find the top K most similar users based on embedding similarity (dot product / cosine).

    Returns:
        List of (user_id, similarity_score) sorted by similarity desc.
    """
    if not user_embeddings:
        return []

    user_ids = list(user_embeddings.keys())
    embedding_matrix = np.array(
        [user_embeddings[uid] for uid in user_ids], dtype=np.float32
    )
    dim = embedding_matrix.shape[1]

    # Build FAISS index for fast similarity search
    index = faiss.IndexFlatIP(dim)  # inner product
    index.add(embedding_matrix)

    k = min(top_k, len(user_ids))
    distances, indices = index.search(current_user_embedding.reshape(1, -1), k)

    results = []
    for sim, idx in zip(distances[0], indices[0]):
        results.append((user_ids[idx], float(sim)))

    # Sort descending
    results.sort(key=lambda x: x[1], reverse=True)
    return results


def cluster_conversations(
    emb1_array: np.ndarray,
    emb2_array: np.ndarray,
    n_clusters: int | None,
    distance_threshold: float | None,
) -> np.ndarray:
    """
    Cluster merged embeddings from two users using agglomerative clustering.

    Args:
        emb1_array: Embedding array for first user's conversations
        emb2_array: Embedding array for second user's conversations
        n_clusters: Number of clusters to create
        linkage: Linkage criterion for agglomerative clustering

    Returns:
        (merged_labels, similarity_matrix) - cluster labels for each conversation and the similarity matrix
    """
    # Normalize embeddings for consistent clustering
    emb1_norm = normalize(emb1_array)
    emb2_norm = normalize(emb2_array)

    # Merge embeddings
    merged_embeddings = np.vstack([emb1_norm, emb2_norm])

    # Perform agglomerative clustering
    clustering = AgglomerativeClustering(
        n_clusters=n_clusters,
        distance_threshold=distance_threshold,
        compute_full_tree=True,
        linkage="ward",
    )

    labels = clustering.fit_predict(merged_embeddings)

    return labels


def load_user_embeddings(user_id, logger):
    """Load user data and embeddings, returning a tuple of (df, embeddings_array)."""
    try:
        df = load_user_dataframe(user_id)
        if df.is_empty():
            return None, None

        df = df.with_row_count("row_idx")
        emb_list = df["embedding"].to_list()

        if not emb_list:
            return None, None

        emb_array = np.array(emb_list, dtype=np.float32)
        return df, emb_array
    except Exception as e:
        logger.error(f"Error loading user {user_id}: {e}")
        return None, None


def collect_user_data(user_ids, logger):
    """Collect user data, average embeddings, and embeddings arrays."""
    user_avg_embeddings = {}
    user_data = {}

    for uid in user_ids:
        df, emb_array = load_user_embeddings(uid, logger)
        if df is not None and emb_array is not None:
            avg_emb = calculate_user_average_embedding(emb_array)
            user_avg_embeddings[uid] = avg_emb
            user_data[uid] = (df, emb_array)

    return user_avg_embeddings, user_data


def create_conversation_pairs_for_clusters(
    current_user_df,
    user2_df,
    user1_indices,
    user2_indices,
    current_user_id,
    other_uid,
    match_group_id,
    cluster_id,
):
    """Create conversation pairs within a cluster."""
    pairs = []
    for i in user1_indices:
        # Get conversation data for current user
        user1_conv = get_conversation_data(current_user_df, i)

        # Add current user's conversation
        pairs.append(
            {
                "user_id": current_user_id,
                "match_group_id": match_group_id,
                "row_idx": user1_conv["row_idx"],
                "conversation_id": user1_conv["conversation_id"],
                "title": user1_conv["title"],
                "summary": user1_conv["summary"],
                "start_date": user1_conv["start_date"],
                "start_time": user1_conv["start_time"],
                "cluster_id": int(cluster_id),
            }
        )

    for j in user2_indices:
        # Get conversation data for other user
        user2_conv = get_conversation_data(user2_df, j)

        # Add other user's conversation
        pairs.append(
            {
                "user_id": other_uid,
                "match_group_id": match_group_id,
                "row_idx": user2_conv["row_idx"],
                "conversation_id": user2_conv["conversation_id"],
                "title": user2_conv["title"],
                "summary": user2_conv["summary"],
                "start_date": user2_conv["start_date"],
                "start_time": user2_conv["start_time"],
                "cluster_id": int(cluster_id),
            }
        )

    return pairs


@multi_asset(
    partitions_def=user_partitions_def,
    ins={"conversations_embeddings": AssetIn(key="conversations_embeddings")},
    outs={
        "conversation_pair_clusters": AssetOut(
            key="conversation_pair_clusters", io_manager_key="parquet_io_manager"
        ),
        "user_similarities": AssetOut(
            key="user_similarities", io_manager_key="parquet_io_manager"
        ),
    },
)
def conversation_pair_clusters(
    context: AssetExecutionContext,
    config: ConversationPairClustersConfig,
    conversations_embeddings: pl.DataFrame,
) -> tuple[pl.DataFrame, pl.DataFrame]:
    """
    Create semantically related conversation pairs grouped by clusters using agglomerative clustering.

    This asset identifies similar conversations between pairs of users by:
    1. Finding the most similar users based on average conversation embeddings using FAISS
    2. For each similar user pair, merging and clustering their conversation embeddings
    3. Creating clusters of semantically related conversations across users
    4. Assigning each conversation to a globally unique cluster ID

    The resulting clusters provide a foundation for identifying serendipitous connections
    between different users' conversations. By pre-grouping related conversations,
    this asset significantly reduces the search space for downstream LLM-based processing.

    Configuration options:
    - top_k_users: Number of most similar users to analyze (default: 10)
    - max_items_per_cluster: Maximum number of items allowed per cluster (default: 1000)
    - linkage: Clustering criterion for agglomerative clustering (default: "ward")

    Returns a tuple of two DataFrames:
    1. Conversation pairs DataFrame with schema:
       - user_id: The user ID
       - match_group_id: ID for the user pair
       - conversation: Struct with conversation details (ID, title, summary, dates)
       - cluster_id: Global cluster ID grouping semantically related conversations
    2. User similarities DataFrame with schema:
       - user_id: The user ID
       - similarity: Similarity score between the current user and this user
    """
    current_user_id = context.partition_key
    logger = context.log

    other_user_ids = get_materialized_partitions(context, "conversations_embeddings")
    other_user_ids = [uid for uid in other_user_ids if uid != current_user_id]

    if not other_user_ids:
        logger.info("No other users found for conversation clustering.")
        return create_empty_result(), pl.DataFrame(
            schema={"user_id": pl.Utf8, "similarity": pl.Float32}
        )

    logger.info(
        f"Processing {len(other_user_ids)} users for conversation clusters with user {current_user_id}"
    )

    # Current user data
    current_user_df = conversations_embeddings.with_row_count("row_idx")
    emb1_list = current_user_df["embedding"].to_list()

    if not emb1_list:
        logger.info("No embeddings for current user, nothing to cluster.")
        return create_empty_result(), pl.DataFrame(
            schema={"user_id": pl.Utf8, "similarity": pl.Float32}
        )

    emb1_array = np.array(emb1_list, dtype=np.float32)
    current_user_avg_embedding = calculate_user_average_embedding(emb1_array)

    # Gather data for other users
    user_avg_embeddings, user_data = collect_user_data(other_user_ids, logger)

    # Find top-K most similar users
    top_users = find_top_k_users(
        current_user_avg_embedding, user_avg_embeddings, config.top_k_users
    )

    # Create user similarities DataFrame
    user_similarities_data = [
        {"user_id": user_id, "similarity": similarity}
        for user_id, similarity in top_users
    ]
    user_similarities_df = (
        pl.DataFrame(
            user_similarities_data,
            schema={"user_id": pl.Utf8, "similarity": pl.Float32},
        )
        if user_similarities_data
        else pl.DataFrame(schema={"user_id": pl.Utf8, "similarity": pl.Float32})
    )

    if not top_users:
        logger.info("No similar users found.")
        return create_empty_result(), user_similarities_df

    all_pairs = []
    # Create a global counter for unique cluster IDs
    global_cluster_id_offset = 0

    for match_group_id, (other_uid, user_user_sim) in enumerate(top_users):
        df2, emb2_array = user_data[other_uid]
        logger.info(f"Clustering conversations with user {other_uid}")

        # Start with minimum number of clusters
        n1 = emb1_array.shape[0]
        n2 = emb2_array.shape[0]

        # If max_items_per_cluster is None, use cosine_difference threshold directly
        if config.max_items_per_cluster is None:
            logger.info(
                f"Using cosine difference threshold {config.cosine_difference} for clustering"
            )
            # Pass None for n_clusters to use distance_threshold instead
            cluster_labels = cluster_conversations(
                emb1_array,
                emb2_array,
                n_clusters=None,
                distance_threshold=config.cosine_difference,
            )
            # Count how many clusters were formed
            n_clusters = len(np.unique(cluster_labels))
            logger.info(f"Created {n_clusters} clusters using cosine threshold")
        else:
            n_clusters = max(1, ceil((n1 + n2) / config.max_items_per_cluster))
            previous_largest_cluster_size = float("inf")
            previous_cluster_labels = None

            for iteration in range(config.max_cluster_iterations):
                logger.info(
                    f"Attempt {iteration + 1}: Creating {n_clusters} clusters for {n1 + n2} total conversations"
                )

                # Cluster the conversations
                current_cluster_labels = cluster_conversations(
                    emb1_array, emb2_array, n_clusters, config.cosine_difference
                )

                # Check if any cluster exceeds the maximum size
                cluster_sizes = np.bincount(current_cluster_labels)
                largest_cluster_size = np.max(cluster_sizes)

                if largest_cluster_size <= config.max_items_per_cluster:
                    logger.info(
                        f"Success: Largest cluster has {largest_cluster_size} items (max: {config.max_items_per_cluster})"
                    )
                    cluster_labels = current_cluster_labels
                    break

                # Check if increasing clusters didn't help reduce the largest cluster size
                if largest_cluster_size >= previous_largest_cluster_size:
                    logger.info(
                        "No improvement in cluster sizes after increasing clusters. Using previous clustering."
                    )
                    # Use the previous clustering results if they exist
                    if previous_cluster_labels is not None:
                        cluster_labels = previous_cluster_labels
                    else:
                        cluster_labels = current_cluster_labels
                    break

                # Save current results before trying with more clusters
                previous_cluster_labels = current_cluster_labels
                previous_largest_cluster_size = largest_cluster_size

                # Increase number of clusters and try again
                logger.info(
                    f"Largest cluster has {largest_cluster_size} items, exceeding max of {config.max_items_per_cluster}"
                )
                n_clusters += 1

                # Safety check - if we somehow need more clusters than items, something is wrong
                if n_clusters >= (n1 + n2):
                    logger.warning("Reached maximum possible clusters, breaking")
                    # Use the current clustering results since we're breaking out
                    cluster_labels = current_cluster_labels
                    break
            else:
                # If we exit the loop normally (by running out of iterations)
                # Use the last clustering attempt
                cluster_labels = current_cluster_labels

        # Extract user1's and user2's cluster labels
        user1_labels = cluster_labels[:n1]
        user2_labels = cluster_labels[n1:]

        # Process each cluster
        for cluster_idx in range(n_clusters):
            # Find conversations in this cluster
            user1_indices = np.where(user1_labels == cluster_idx)[0]
            user2_indices = np.where(user2_labels == cluster_idx)[0]

            # Create pairs between all conversations in the same cluster
            global_cluster_id = cluster_idx + global_cluster_id_offset

            cluster_pairs = create_conversation_pairs_for_clusters(
                current_user_df,
                df2,
                user1_indices,
                user2_indices,
                current_user_id,
                other_uid,
                match_group_id,
                global_cluster_id,
            )

            all_pairs.extend(cluster_pairs)

        # Update global offset for next user pair
        global_cluster_id_offset += n_clusters

    if all_pairs:
        result_df = pl.DataFrame(all_pairs, schema=CONVERSATION_PAIR_SCHEMA)
        return result_df.sort(["cluster_id"], descending=[False]), user_similarities_df
    else:
        return create_empty_result(), user_similarities_df
