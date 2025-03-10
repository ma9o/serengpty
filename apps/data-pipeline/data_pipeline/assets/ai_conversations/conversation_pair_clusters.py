from typing import Literal

import numpy as np
import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    AssetOut,
    multi_asset,
)

from data_pipeline.assets.ai_conversations.utils.clustering import cluster_embeddings
from data_pipeline.assets.ai_conversations.utils.data_loading import (
    get_materialized_partitions,
)
from data_pipeline.assets.ai_conversations.utils.find_top_k_users import (
    find_top_k_users,
    load_user_embeddings,
)
from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.partitions import user_partitions_def


class ConversationPairClustersConfig(RowLimitConfig):
    # Number of top similar users to consider
    top_k_users: int = 5
    dimension_reduction_method: Literal["pca", "umap"] = "umap"
    dimension_reduction_n_components: int = 100
    clustering_method: Literal["agglomerative", "hdbscan"] = "hdbscan"


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


def collect_user_data(user_ids, logger):
    """Collect user data, average embeddings, and embeddings arrays."""
    user_embeddings = {}
    user_data = {}

    for uid in user_ids:
        df, emb_array = load_user_embeddings(uid)
        if df is not None and emb_array is not None:
            user_embeddings[uid] = emb_array
            user_data[uid] = (df, emb_array)

    return user_embeddings, user_data


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

    # Find top-K most similar users using the updated function
    top_users = find_top_k_users(emb1_array, other_user_ids, config.top_k_users)

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

    # Load embeddings only for the top K users
    user_data = {}
    for user_id, _ in top_users:
        df, embeddings = load_user_embeddings(user_id)
        if df is not None and embeddings is not None:
            user_data[user_id] = (df, embeddings)

    all_pairs = []
    global_cluster_id_offset = 0

    for match_group_id, (other_uid, user_user_sim) in enumerate(top_users):
        df2, emb2_array = user_data[other_uid]
        logger.info(f"Clustering conversations with user {other_uid}")

        # Perform clustering using the module with all configuration options
        user1_labels, user2_labels = cluster_embeddings(
            emb1_array,
            emb2_array,
            dimension_reduction_method=config.dimension_reduction_method,
            dimension_reduction_n_components=config.dimension_reduction_n_components,
            clustering_method=config.clustering_method,
            log=logger.info,
        )

        n_clusters = len(np.unique(user1_labels)) + len(np.unique(user2_labels))
        logger.info(f"Created {n_clusters} clusters using {config.clustering_method}")

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
        result_df = pl.DataFrame(all_pairs, schema=CONVERSATION_PAIR_SCHEMA).sort(
            ["cluster_id"], descending=[False]
        )
    else:
        result_df = create_empty_result()

    # TODO: messy
    # Join back with conversation_embeddings to add the embedding column
    if len(result_df) > 0:
        # We need embeddings for all user_ids in the result
        unique_user_ids = result_df["user_id"].unique().to_list()
        all_embeddings = []

        # First add current user's embeddings
        all_embeddings.append(
            conversations_embeddings.select("conversation_id", "embedding")
        )

        # Then load embeddings for other users in the result
        for uid in unique_user_ids:
            if uid != current_user_id:
                user_df, _ = load_user_embeddings(uid)
                if user_df is not None:
                    all_embeddings.append(
                        user_df.select("conversation_id", "embedding")
                    )

        # Combine all embeddings and join with result
        if all_embeddings:
            combined_embeddings = pl.concat(all_embeddings)
            result_df = result_df.join(
                combined_embeddings, on="conversation_id", how="left"
            )

    return result_df, user_similarities_df
