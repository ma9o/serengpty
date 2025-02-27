import faiss
import numpy as np
import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    asset,
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
    # Number of clusters to create
    n_clusters: int = 4
    # Linkage criterion for clustering
    linkage: str = "ward"  # Options: "ward", "complete", "average", "single"


# Define schema once to avoid repetition
CONVERSATION_PAIR_SCHEMA = {
    "user_id": pl.Utf8,
    "match_group_id": pl.UInt32,
    "conversation": pl.Struct(
        {
            "row_idx": pl.UInt32,
            "conversation_id": pl.Utf8,
            "title": pl.Utf8,
            "summary": pl.Utf8,
            "start_date": pl.Utf8,
            "start_time": pl.Utf8,
        }
    ),
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
    n_clusters: int,
    linkage: str,
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
        linkage=linkage,
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
                "conversation": user1_conv,
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
                "conversation": user2_conv,
                "cluster_id": int(cluster_id),
            }
        )

    return pairs


@asset(
    partitions_def=user_partitions_def,
    ins={"conversations_embeddings": AssetIn(key="conversations_embeddings")},
    io_manager_key="parquet_io_manager",
)
def conversation_pair_clusters(
    context: AssetExecutionContext,
    config: ConversationPairClustersConfig,
    conversations_embeddings: pl.DataFrame,
) -> pl.DataFrame:
    """
    Create conversation pairs grouped by clusters using agglomerative clustering.
    For each pair of users, merge their conversation embeddings and cluster them,
    assigning each conversation to a globally unique cluster ID.
    """
    current_user_id = context.partition_key
    logger = context.log

    other_user_ids = get_materialized_partitions(context, "conversations_embeddings")
    other_user_ids = [uid for uid in other_user_ids if uid != current_user_id]

    if not other_user_ids:
        logger.info("No other users found for conversation clustering.")
        return create_empty_result()

    logger.info(
        f"Processing {len(other_user_ids)} users for conversation clusters with user {current_user_id}"
    )

    # Current user data
    current_user_df = conversations_embeddings.with_row_count("row_idx")
    emb1_list = current_user_df["embedding"].to_list()

    if not emb1_list:
        logger.info("No embeddings for current user, nothing to cluster.")
        return create_empty_result()

    emb1_array = np.array(emb1_list, dtype=np.float32)
    current_user_avg_embedding = calculate_user_average_embedding(emb1_array)

    # Gather data for other users
    user_avg_embeddings, user_data = collect_user_data(other_user_ids, logger)

    # Find top-K most similar users
    top_users = find_top_k_users(
        current_user_avg_embedding, user_avg_embeddings, config.top_k_users
    )

    if not top_users:
        logger.info("No similar users found.")
        return create_empty_result()

    all_pairs = []
    # Create a global counter for unique cluster IDs
    global_cluster_id_offset = 0
    n_clusters = config.n_clusters

    for match_group_id, (other_uid, user_user_sim) in enumerate(top_users):
        df2, emb2_array = user_data[other_uid]
        logger.info(f"Clustering conversations with user {other_uid}")

        n1 = emb1_array.shape[0]
        n2 = emb2_array.shape[0]

        # Skip if either user has no conversations
        if n1 == 0 or n2 == 0:
            continue

        # Cluster the conversations
        cluster_labels = cluster_conversations(
            emb1_array, emb2_array, n_clusters, config.linkage
        )

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

        return result_df.sort(["cluster_id"], descending=[False])
    else:
        return create_empty_result()
