import datetime
import uuid

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


class SerendipitySimpleConfig(RowLimitConfig):
    # Maximum paths to return per user pair
    max_paths_per_pair: int = 10


@asset(
    partitions_def=user_partitions_def,
    ins={"conversations_embeddings": AssetIn(key="conversations_embeddings")},
    io_manager_key="parquet_io_manager",
)
def serendipity_simple(
    context: AssetExecutionContext,
    config: SerendipitySimpleConfig,
    gemini_flash: BaseLlmResource,
    conversations_embeddings: pl.DataFrame,
) -> pl.DataFrame:
    """
    Discovers serendipitous paths between the current user's conversations and other users'
    conversations by iteratively prompting an LLM.

    The LLM sees a truncated, integer-based "ID" for each conversation, but internally we track
    and exclude by `conversation_id` (UUID). Each time we discover a new path, we remove those
    conversation IDs from subsequent prompts to avoid repetition.

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

    # 1) Prepare current user conversations
    current_user_summaries = prepare_conversation_summaries(conversations_embeddings)

    # 2) For each other user, load their conversation summaries
    user_data = {}
    for user_id in other_user_ids:
        other_user_df = load_user_dataframe(user_id)
        if other_user_df.height == 0:
            logger.info(f"No valid conversations for user {user_id}, skipping.")
            continue

        other_user_summaries = prepare_conversation_summaries(other_user_df)

        user_data[user_id] = {
            "summaries": other_user_summaries,
            "excluded_ids_user1": set(),  # conversation_id's from current user
            "excluded_ids_user2": set(),  # conversation_id's from other user
            "paths_found": 0,
            "iteration": 0,
        }

    all_paths = []

    # 3) Iteratively find paths across all other users
    while True:
        prompt_sequences = []
        user_pair_info = []

        # Generate prompts for each user pair that hasn't reached max_paths
        for user_id, data in user_data.items():
            if data["paths_found"] >= config.max_paths_per_pair:
                continue

            prompt, user1_idx_map, user2_idx_map = generate_serendipity_prompt(
                current_user_summaries,
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
                    }
                )

        if not prompt_sequences:
            # No more prompts to process → break out
            break

        logger.info(f"Batch processing {len(prompt_sequences)} user pairs...")

        # 4) Get batch completions from the LLM
        completions, cost = gemini_flash.get_prompt_sequences_completions_batch(
            prompt_sequences
        )
        logger.info(f"Batch completed. LLM cost: ${cost:.2f}")

        # 5) Process each LLM response
        paths_found_any = False
        for i, completion in enumerate(completions):
            user_id = user_pair_info[i]["user_id"]
            user1_idx_map = user_pair_info[i]["user1_idx_map"]
            user2_idx_map = user_pair_info[i]["user2_idx_map"]
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
                    "path_description": path_description,
                    "iteration": user_info["iteration"],
                    "created_at": datetime.datetime.now(),
                    "llm_output": response_text,
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

    # 6) Build the final result DataFrame
    if all_paths:
        result_df = pl.DataFrame(all_paths, schema_overrides={"iteration": pl.Int32})

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
        return pl.DataFrame(schema=get_empty_result_schema())
