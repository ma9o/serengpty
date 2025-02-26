import datetime
import uuid
from typing import Dict, List, Set

import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    asset,
)

from data_pipeline.assets.ai_conversations.utils.serendipity import (
    generate_serendipity_prompt,
    get_empty_result_schema,
    parse_serendipity_result,
)
from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.batch_inference.base_llm_resource import BaseLlmResource


class SerendipityOptimizedConfig(RowLimitConfig):
    # Maximum paths to return per user pair
    max_paths_per_pair: int = 10


@asset(
    partitions_def=user_partitions_def,
    ins={"conversation_pair_candidates": AssetIn(key="conversation_pair_candidates")},
    io_manager_key="parquet_io_manager",
)
def serendipity_optimized(
    context: AssetExecutionContext,
    config: SerendipityOptimizedConfig,
    gemini_flash: BaseLlmResource,
    conversation_pair_candidates: pl.DataFrame,
) -> pl.DataFrame:
    """
    Discovers serendipitous paths between users' conversations using pre-filtered
    conversation pairs from conversation_pair_candidates.
    
    This asset focuses purely on finding meaningful connections between conversation pairs
    that have already been identified as potentially related based on embedding similarity.
    
    Processing steps:
    1. Groups conversation pairs by user2_id
    2. For each user pair, extracts conversation details and sorts by date and time
    3. Iteratively generates prompts and calls the LLM to find serendipitous paths
    4. Builds a result DataFrame with path information
    
    The conversations are sorted chronologically before being sent to the LLM to help it
    identify temporal progression in topics and interests.

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
    logger = context.log

    if conversation_pair_candidates.height == 0:
        logger.info("No conversation pair candidates found, returning empty result.")
        return pl.DataFrame(schema=get_empty_result_schema())

    # Group by user2_id to process each user pair separately
    user_groups = conversation_pair_candidates.group_by("user2_id")
    
    # Organize conversation pairs by user2_id
    user_data = {}
    
    for user_group in user_groups:
        user2_id = user_group["user2_id"][0]
        user_df = user_group.select(pl.exclude("user2_id"))
        
        # Extract user1 (current user) and user2 conversation data
        user1_summaries = []
        user2_summaries = []
        
        for row in user_df.iter_rows(named=True):
            conv1 = row["conv1"]
            conv2 = row["conv2"]
            
            # Add to respective summaries lists
            user1_summaries.append({
                "row_idx": conv1["row_idx"],
                "conversation_id": conv1["conversation_id"],
                "title": conv1["title"],
                "summary": conv1["summary"],
                "date": f"{conv1['start_date']} {conv1['start_time']}",
                "start_date": conv1["start_date"],
                "start_time": conv1["start_time"],
            })
            
            user2_summaries.append({
                "row_idx": conv2["row_idx"],
                "conversation_id": conv2["conversation_id"],
                "title": conv2["title"],
                "summary": conv2["summary"],
                "date": f"{conv2['start_date']} {conv2['start_time']}",
                "start_date": conv2["start_date"],
                "start_time": conv2["start_time"],
            })
        
        # Sort summaries by date and time
        user1_summaries.sort(key=lambda x: (x.get("start_date", ""), x.get("start_time", "")))
        user2_summaries.sort(key=lambda x: (x.get("start_date", ""), x.get("start_time", "")))
        
        # Calculate average similarity for this user pair
        avg_similarity = user_df["cosine_similarity"].mean()
        
        # Store data for this user pair
        user_data[user2_id] = {
            "current_summaries": user1_summaries,
            "summaries": user2_summaries,
            "excluded_ids_user1": set(),  # conversation_id's from current user
            "excluded_ids_user2": set(),  # conversation_id's from other user
            "paths_found": 0,
            "iteration": 0,
            "user_similarity_score": float(avg_similarity),
        }
    
    logger.info(f"Processing {len(user_data)} user pairs for serendipitous paths")
    
    # Iteratively find paths across user pairs
    all_paths = []

    while True:
        prompt_sequences = []
        user_pair_info = []

        # Generate prompts for each user pair that hasn't reached max_paths
        for user_id, data in user_data.items():
            if data["paths_found"] >= config.max_paths_per_pair:
                continue

            # Use the summaries specific to this user pair
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

        # Get batch completions from the LLM
        completions, cost = gemini_flash.get_prompt_sequences_completions_batch(
            prompt_sequences
        )
        logger.info(f"Batch completed. LLM cost: ${cost:.2f}")

        # Process each LLM response
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
                    "user1_id": current_user_id,
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

    # Build the final result DataFrame
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
        # Add user1_id field to the schema (user1_id is now explicit rather than implicit)
        schema["user1_id"] = pl.Utf8
        # Add similarity_score and path length fields to the schema
        schema["user_similarity_score"] = pl.Float32
        schema["user1_path_length"] = pl.Int32
        schema["user2_path_length"] = pl.Int32
        return pl.DataFrame(schema=schema)
