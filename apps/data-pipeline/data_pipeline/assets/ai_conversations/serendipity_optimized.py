import datetime
import uuid
from typing import Dict, List, Tuple

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
    generate_serendipity_prompt,
    get_empty_result_schema,
    parse_serendipity_result,
    prepare_conversation_summaries,
)
from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.batch_inference.base_llm_resource import BaseLlmResource


class SerendipityOptimizedConfig(RowLimitConfig):
    # Maximum paths to return per user pair
    max_paths_per_pair: int = 10
    # Number of top similar users to consider
    top_k_users: int = 10
    # Number of top similar conversations per user to consider
    top_k_conversations: int = 700
    # Minimum similarity threshold for embeddings
    min_similarity_threshold: float = 0.3


def find_similar_users(
    current_user_embedding: np.ndarray,
    user_embeddings: Dict[str, np.ndarray],
    top_k: int,
) -> List[Tuple[str, float]]:
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
    user_embeddings: List[np.ndarray],
    other_user_embeddings: List[np.ndarray],
    top_k: int,
    min_similarity: float,
) -> List[Tuple[int, int, float]]:
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


def calculate_user_average_embedding(embeddings: List[np.ndarray]) -> np.ndarray:
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
def serendipity_optimized(
    context: AssetExecutionContext,
    config: SerendipityOptimizedConfig,
    gemini_flash: BaseLlmResource,
    conversations_embeddings: pl.DataFrame,
) -> pl.DataFrame:
    """
    Discovers serendipitous paths between users' conversations using embedding similarity
    pre-filtering to reduce the search space.

    Optimization approach:
    1. First find the top K1 most similar users based on average embedding similarity
    2. For each similar user, find the top K2 most similar conversation pairs
    3. Only use these filtered conversation pairs for LLM prompting

    This significantly reduces the search space and LLM usage while maintaining quality.

    Output columns:
    - path_id
    - user1_id
    - user2_id
    - user1_conversation_ids (list of the conversation_id UUIDs)
    - user2_conversation_ids (list of the conversation_id UUIDs)
    - path_description
    - iteration
    - created_at
    - llm_output (raw JSON response from the LLM)
    - user_similarity_score (average similarity of the conversation embeddings)
    """
    current_user_id = context.partition_key
    other_user_ids = get_materialized_partitions(context, "conversations_embeddings")
    logger = context.log

    # Filter out the current user from other_user_ids if present
    other_user_ids = [uid for uid in other_user_ids if uid != current_user_id]

    if not other_user_ids:
        logger.info("No other users found for serendipitous path detection.")
        # Return an empty DataFrame with the proper schema
        return pl.DataFrame(schema=get_empty_result_schema())

    logger.info(
        f"Processing {len(other_user_ids)} users for serendipitous paths with user {current_user_id}"
    )

    # 1) Prepare current user conversations and calculate average embedding
    current_user_summaries = prepare_conversation_summaries(conversations_embeddings)
    current_user_embeddings = conversations_embeddings["embedding"].to_list()
    current_user_avg_embedding = calculate_user_average_embedding(
        current_user_embeddings
    )

    # 2) Calculate average embeddings for all other users
    user_avg_embeddings = {}
    user_embeddings_data = {}

    for user_id in other_user_ids:
        try:
            other_user_df = load_user_dataframe(user_id)
            if other_user_df.height == 0:
                logger.info(f"No valid conversations for user {user_id}, skipping.")
                continue

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

    # 3) Find top K similar users
    similar_users = find_similar_users(
        current_user_avg_embedding,
        user_avg_embeddings,
        config.top_k_users,
    )

    logger.info(f"Found {len(similar_users)} similar users above threshold")

    if not similar_users:
        logger.info("No similar users found above threshold.")
        return pl.DataFrame(schema=get_empty_result_schema())

    # 4) For each similar user, find top K similar conversation pairs
    user_data = {}

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

        # Prepare filtered conversation summaries
        other_user_summaries = prepare_conversation_summaries(other_user_df)

        # Track which conversations to include for this user pair (by index)
        current_user_indices = set(idx1 for idx1, _, _ in similar_conversations)
        other_user_indices = set(idx2 for _, idx2, _ in similar_conversations)

        # Filter summaries to only include conversations with similar pairs
        filtered_current_summaries = [
            s for s in current_user_summaries if s["row_idx"] in current_user_indices
        ]

        filtered_other_summaries = [
            s for s in other_user_summaries if s["row_idx"] in other_user_indices
        ]

        # Calculate average similarity score for this user pair
        avg_similarity = sum(sim for _, _, sim in similar_conversations) / len(
            similar_conversations
        )

        user_data[user_id] = {
            "summaries": filtered_other_summaries,
            "excluded_ids_user1": set(),  # conversation_id's from current user
            "excluded_ids_user2": set(),  # conversation_id's from other user
            "paths_found": 0,
            "iteration": 0,
            "user_similarity_score": avg_similarity,
            "current_summaries": filtered_current_summaries,
        }

    # 5) Iteratively find paths across filtered user pairs
    all_paths = []

    while True:
        prompt_sequences = []
        user_pair_info = []

        # Generate prompts for each user pair that hasn't reached max_paths
        for user_id, data in user_data.items():
            if data["paths_found"] >= config.max_paths_per_pair:
                continue

            # Use the filtered summaries specific to this user pair
            prompt, user1_idx_map, user2_idx_map = generate_serendipity_prompt(
                data["current_summaries"],
                data["summaries"],
                user1_excluded_ids=data["excluded_ids_user1"],
                user2_excluded_ids=data["excluded_ids_user2"],
            )

            if prompt:
                # We'll store the index mappings so we can decode the LLM response later
                prompt_sequences.append([prompt])
                user_pair_info.append(
                    {
                        "user_id": user_id,
                        "user1_idx_map": user1_idx_map,
                        "user2_idx_map": user2_idx_map,
                        "user_similarity_score": data["user_similarity_score"],
                    }
                )

        if not prompt_sequences:
            # No more prompts to process → break out
            break

        logger.info(f"Batch processing {len(prompt_sequences)} user pairs...")

        # 6) Get batch completions from the LLM
        completions, cost = gemini_flash.get_prompt_sequences_completions_batch(
            prompt_sequences
        )
        logger.info(f"Batch completed. LLM cost: ${cost:.2f}")

        # 7) Process each LLM response
        paths_found_any = False
        for i, completion in enumerate(completions):
            user_id = user_pair_info[i]["user_id"]
            user1_idx_map = user_pair_info[i]["user1_idx_map"]
            user2_idx_map = user_pair_info[i]["user2_idx_map"]
            similarity_score = user_pair_info[i]["user_similarity_score"]
            user_info = user_data[user_id]

            # Parse the JSON from the LLM
            try:
                response_text = completion[-1]  # last message is the LLM's response
                path_obj = parse_serendipity_result(response_text)
            except (IndexError, Exception) as e:
                logger.warning(
                    f"Error processing LLM response for user pair with {user_id}: {str(e)}"
                )
                continue

            # Make sure it has the expected structure
            if not isinstance(path_obj, dict):
                continue

            # If the LLM found a valid connection
            user1_indices = path_obj.get("user1_row_indices", [])
            user2_indices = path_obj.get("user2_row_indices", [])
            path_description = path_obj.get("path_description", "")

            # If we got a non-empty path
            if user1_indices or user2_indices or path_description:
                paths_found_any = True
                user_info["paths_found"] += 1

                # Map local indices -> conversation_id
                user1_conv_ids = [
                    user1_idx_map[idx] for idx in user1_indices if idx in user1_idx_map
                ]
                user2_conv_ids = [
                    user2_idx_map[idx] for idx in user2_indices if idx in user2_idx_map
                ]

                # Build the path entry
                path_entry = {
                    "path_id": str(uuid.uuid4()),
                    "user2_id": user_id,
                    "user1_conversation_ids": user1_conv_ids,
                    "user2_conversation_ids": user2_conv_ids,
                    "user1_path_length": len(user1_conv_ids),
                    "user2_path_length": len(user2_conv_ids),
                    "path_description": path_description,
                    "iteration": user_info["iteration"],
                    "created_at": datetime.datetime.now(),
                    "llm_output": response_text,
                    "user_similarity_score": similarity_score,
                }
                all_paths.append(path_entry)

                # Exclude these conversation IDs from subsequent prompts
                user_info["excluded_ids_user1"].update(user1_conv_ids)
                user_info["excluded_ids_user2"].update(user2_conv_ids)

            # Increment iteration for the user pair
            user_info["iteration"] += 1

        # If in this entire batch we found no paths, there's no need to continue
        if not paths_found_any:
            break

    # 8) Build the final result DataFrame
    if all_paths:
        result_df = pl.DataFrame(
            all_paths,
            schema_overrides={
                "iteration": pl.Int32,
                "user_similarity_score": pl.Float32,
                "user1_path_length": pl.Int32,
                "user2_path_length": pl.Int32,
            },
        )

        # Assert that there are no duplicates across both conversation ID lists
        user1_exploded = result_df.select(
            pl.col("user1_conversation_ids").explode().alias("conversation_id")
        )
        user2_exploded = result_df.select(
            pl.col("user2_conversation_ids").explode().alias("conversation_id")
        )
        all_exploded = pl.concat([user1_exploded, user2_exploded])

        all_unique = all_exploded.unique()
        if all_exploded.height != all_unique.height:
            context.log.error(
                f"Found {all_exploded.height - all_unique.height} duplicate conversation IDs across user1 and user2 lists"
            )

        return result_df
    else:
        # Return an empty DataFrame with the proper schema
        schema = get_empty_result_schema()
        # Add similarity_score and path length fields to the schema
        schema["user_similarity_score"] = pl.Float32
        schema["user1_path_length"] = pl.Int32
        schema["user2_path_length"] = pl.Int32
        return pl.DataFrame(schema=schema)
