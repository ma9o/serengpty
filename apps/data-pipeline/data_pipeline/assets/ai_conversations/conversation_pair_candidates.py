import faiss
import numpy as np
import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    asset,
)

from data_pipeline.assets.ai_conversations.utils.data_loading import (
    get_materialized_partitions,
    load_user_dataframe,
)
from data_pipeline.assets.ai_conversations.utils.serendipity import (
    prepare_conversation_summaries,
)
from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.partitions import user_partitions_def


class ConversationPairCandidatesConfig(RowLimitConfig):
    # Number of top similar users to consider
    top_k_users: int = 10
    # Number of top similar conversations per user to consider
    top_k_conversations: int = 700
    # Minimum similarity threshold for embeddings
    min_similarity_threshold: float = 0.3


def find_similar_users(
    current_user_embedding: np.ndarray,
    user_embeddings: dict[str, np.ndarray],
    top_k: int,
) -> list[tuple[str, float]]:
    """
    Find the top K most similar users based on embedding similarity.

    Args:
        current_user_embedding: Average embedding vector for the current user
        user_embeddings: Dict mapping user_id to their average embedding vector
        top_k: Number of top similar users to return

    Returns:
        List of (user_id, similarity_score) tuples sorted by similarity (highest first)
    """
    if not user_embeddings:
        return []

    # Create a list of user IDs and embeddings
    user_ids = list(user_embeddings.keys())
    embedding_matrix = np.array(
        [user_embeddings[uid] for uid in user_ids], dtype=np.float32
    )

    # Build FAISS index for fast similarity search
    dim = embedding_matrix.shape[1]
    index = faiss.IndexFlatIP(
        dim
    )  # Inner product for cosine similarity with normalized vectors
    index.add(embedding_matrix)

    # Search for similar users
    k = min(top_k, len(user_ids))
    distances, indices = index.search(current_user_embedding.reshape(1, -1), k)

    # Extract results
    results = []
    for i, (similarity, idx) in enumerate(zip(distances[0], indices[0])):
        results.append((user_ids[idx], float(similarity)))

    return results


def find_similar_conversations(
    user_embeddings: list[np.ndarray],
    other_user_embeddings: list[np.ndarray],
    top_k: int,
    min_similarity: float,
) -> list[tuple[int, int, float]]:
    """
    Find the top K most similar conversation pairs between two users.

    Args:
        user_embeddings: List of embedding vectors for the current user's conversations
        other_user_embeddings: List of embedding vectors for the other user's conversations
        top_k: Number of top similar conversation pairs to return
        min_similarity: Minimum similarity threshold

    Returns:
        List of (user1_idx, user2_idx, similarity_score) tuples sorted by similarity
    """
    if not user_embeddings or not other_user_embeddings:
        return []

    # Convert lists to numpy arrays
    emb1_array = np.array(user_embeddings, dtype=np.float32)
    emb2_array = np.array(other_user_embeddings, dtype=np.float32)

    # Get embedding dimension
    dim = emb1_array.shape[1]

    # Build FAISS index
    index = faiss.IndexFlatIP(dim)
    index.add(emb2_array)

    # Search for similar conversations
    k = min(top_k, emb2_array.shape[0])
    distances, indices = index.search(emb1_array, k)

    # Extract results
    results = []
    for idx1, (similarities, neighbor_indices) in enumerate(zip(distances, indices)):
        for similarity, idx2 in zip(similarities, neighbor_indices):
            if similarity >= min_similarity:
                results.append((idx1, int(idx2), float(similarity)))

    # Sort by similarity score (highest first)
    return sorted(results, key=lambda x: x[2], reverse=True)[:top_k]


def calculate_user_average_embedding(embeddings: list[np.ndarray]) -> np.ndarray:
    """Calculate the average embedding vector for a user."""
    if not embeddings:
        return np.array([])

    # Stack embeddings and compute mean
    stacked = np.vstack(embeddings)
    return np.mean(stacked, axis=0)


@asset(
    partitions_def=user_partitions_def,
    ins={"conversations_embeddings": AssetIn(key="conversations_embeddings")},
    io_manager_key="parquet_io_manager",
)
def conversation_pair_candidates(
    context: AssetExecutionContext,
    config: ConversationPairCandidatesConfig,
    conversations_embeddings: pl.DataFrame,
) -> pl.DataFrame:
    """
    Create candidate conversation pairs for serendipity detection.
    
    This asset finds similar users based on embedding similarity and then identifies
    potentially related conversation pairs between the current user and those similar users.
    
    Output columns:
    - user2_id: ID of the second user (user1_id is implicit from partitioning)
    - conv1: Struct with conversation data from user1 (row_idx, conversation_id, title, summary, start_date, start_time)
    - conv2: Struct with conversation data from user2 (row_idx, conversation_id, title, summary, start_date, start_time)
    - cosine_similarity: Similarity score between the two conversations
    """
    current_user_id = context.partition_key
    other_user_ids = get_materialized_partitions(context, "conversations_embeddings")
    logger = context.log

    # Filter out the current user from other_user_ids if present
    other_user_ids = [uid for uid in other_user_ids if uid != current_user_id]

    if not other_user_ids:
        logger.info("No other users found for candidate pair detection.")
        # Return an empty DataFrame with the proper schema
        return pl.DataFrame(
            schema={
                "user2_id": pl.Utf8,
                "conv1": pl.Struct({
                    "row_idx": pl.UInt32,
                    "conversation_id": pl.Utf8,
                    "title": pl.Utf8,
                    "summary": pl.Utf8,
                    "start_date": pl.Utf8,
                    "start_time": pl.Utf8,
                }),
                "conv2": pl.Struct({
                    "row_idx": pl.UInt32,
                    "conversation_id": pl.Utf8,
                    "title": pl.Utf8,
                    "summary": pl.Utf8,
                    "start_date": pl.Utf8,
                    "start_time": pl.Utf8,
                }),
                "cosine_similarity": pl.Float32,
            }
        )

    logger.info(
        f"Processing {len(other_user_ids)} users for conversation pairs with user {current_user_id}"
    )

    # Prepare current user conversations and calculate average embedding
    current_user_df = conversations_embeddings.with_row_count("row_idx")
    current_user_summaries = prepare_conversation_summaries(current_user_df)
    current_user_embeddings = current_user_df["embedding"].to_list()
    current_user_avg_embedding = calculate_user_average_embedding(
        current_user_embeddings
    )

    # Calculate average embeddings for all other users
    user_avg_embeddings = {}
    user_embeddings_data = {}

    for user_id in other_user_ids:
        try:
            other_user_df = load_user_dataframe(user_id)
            if other_user_df.height == 0:
                logger.info(f"No valid conversations for user {user_id}, skipping.")
                continue

            other_user_df = other_user_df.with_row_count("row_idx")
            other_user_embeddings = other_user_df["embedding"].to_list()
            if not other_user_embeddings:
                continue

            # Calculate and store average embedding
            avg_embedding = calculate_user_average_embedding(other_user_embeddings)
            user_avg_embeddings[user_id] = avg_embedding

            # Store data for later use
            user_embeddings_data[user_id] = {
                "df": other_user_df,
                "embeddings": other_user_embeddings,
            }

        except Exception as e:
            logger.error(f"Error processing embeddings for user {user_id}: {str(e)}")
            continue

    # Find top K similar users
    similar_users = find_similar_users(
        current_user_avg_embedding,
        user_avg_embeddings,
        config.top_k_users,
    )

    logger.info(f"Found {len(similar_users)} similar users above threshold")

    if not similar_users:
        logger.info("No similar users found above threshold.")
        return pl.DataFrame(
            schema={
                "user2_id": pl.Utf8,
                "conv1": pl.Struct({
                    "row_idx": pl.UInt32,
                    "conversation_id": pl.Utf8,
                    "title": pl.Utf8,
                    "summary": pl.Utf8,
                    "start_date": pl.Utf8,
                    "start_time": pl.Utf8,
                }),
                "conv2": pl.Struct({
                    "row_idx": pl.UInt32,
                    "conversation_id": pl.Utf8,
                    "title": pl.Utf8,
                    "summary": pl.Utf8,
                    "start_date": pl.Utf8,
                    "start_time": pl.Utf8,
                }),
                "cosine_similarity": pl.Float32,
            }
        )

    # For each similar user, find top K similar conversation pairs
    all_pairs = []

    for user_id, user_similarity in similar_users:
        logger.info(f"Processing user {user_id} with similarity {user_similarity:.4f}")

        other_user_df = user_embeddings_data[user_id]["df"]
        other_user_embeddings = user_embeddings_data[user_id]["embeddings"]

        # Find similar conversation pairs
        similar_conversations = find_similar_conversations(
            current_user_embeddings,
            other_user_embeddings,
            config.top_k_conversations,
            config.min_similarity_threshold,
        )

        if not similar_conversations:
            logger.info(f"No similar conversations found for user {user_id}")
            continue

        # Create conversation pair records
        for user1_idx, user2_idx, similarity in similar_conversations:
            # Get the full conversation records
            user1_conv = current_user_df.filter(pl.col("row_idx") == user1_idx).select(
                "row_idx", "conversation_id", "title", "summary", "start_date", "start_time"
            ).row(0, named=True)
            
            user2_conv = other_user_df.filter(pl.col("row_idx") == user2_idx).select(
                "row_idx", "conversation_id", "title", "summary", "start_date", "start_time"
            ).row(0, named=True)
            
            # Add pair to results
            all_pairs.append({
                "user2_id": user_id,
                "conv1": user1_conv,
                "conv2": user2_conv,
                "cosine_similarity": similarity,
            })

    # Build the final result DataFrame
    if all_pairs:
        result_df = pl.DataFrame(
            all_pairs,
            schema={
                "user2_id": pl.Utf8,
                "conv1": pl.Struct({
                    "row_idx": pl.UInt32,
                    "conversation_id": pl.Utf8,
                    "title": pl.Utf8,
                    "summary": pl.Utf8,
                    "start_date": pl.Utf8,
                    "start_time": pl.Utf8,
                }),
                "conv2": pl.Struct({
                    "row_idx": pl.UInt32,
                    "conversation_id": pl.Utf8,
                    "title": pl.Utf8,
                    "summary": pl.Utf8,
                    "start_date": pl.Utf8,
                    "start_time": pl.Utf8,
                }),
                "cosine_similarity": pl.Float32,
            }
        )
        
        # Sort by similarity score
        result_df = result_df.sort("cosine_similarity", descending=True)
        
        return result_df
    else:
        # Return an empty DataFrame with the proper schema
        return pl.DataFrame(
            schema={
                "user2_id": pl.Utf8,
                "conv1": pl.Struct({
                    "row_idx": pl.UInt32,
                    "conversation_id": pl.Utf8,
                    "title": pl.Utf8,
                    "summary": pl.Utf8,
                    "start_date": pl.Utf8,
                    "start_time": pl.Utf8,
                }),
                "conv2": pl.Struct({
                    "row_idx": pl.UInt32,
                    "conversation_id": pl.Utf8,
                    "title": pl.Utf8,
                    "summary": pl.Utf8,
                    "start_date": pl.Utf8,
                    "start_time": pl.Utf8,
                }),
                "cosine_similarity": pl.Float32,
            }
        )