import datetime
import uuid
from typing import Dict, List, Set

import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    asset,
)
from json_repair import repair_json

from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.constants.environments import DAGSTER_STORAGE_DIRECTORY
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.batch_inference.base_llm_resource import BaseLlmResource


def load_user_dataframe(user_id: str) -> pl.DataFrame:
    """Load a user's dataframe from Parquet."""
    return pl.read_parquet(
        DAGSTER_STORAGE_DIRECTORY / "conversation_summaries" / f"{user_id}.snappy"
    )


def get_materialized_partitions(context: AssetExecutionContext, asset_name: str):
    """Retrieve only currently active (non-deleted) partitions for a given asset."""
    # Fetch all materialized partitions
    materialized_partitions = context.instance.get_materialized_partitions(
        context.asset_key_for_input(asset_name)
    )
    # Fetch current dynamic partitions
    current_dynamic_partitions = context.instance.get_dynamic_partitions("users")
    # Filter out deleted partitions
    filtered_partitions = [
        partition
        for partition in materialized_partitions
        if partition in current_dynamic_partitions
    ]
    return filtered_partitions


def generate_serendipity_prompt(
    user1_summaries: List[Dict],
    user2_summaries: List[Dict],
    user1_excluded_ids: Set[str] = None,
    user2_excluded_ids: Set[str] = None,
):
    """
    Generate a prompt for finding serendipitous paths between two users' conversation summaries.
    The LLM sees integer indices, but we exclude by conversation UUIDs under the hood.
    """
    if user1_excluded_ids is None:
        user1_excluded_ids = set()
    if user2_excluded_ids is None:
        user2_excluded_ids = set()

    # Filter out conversations whose conversation_id is in the exclude set
    filtered_user1 = [
        s for s in user1_summaries if s["conversation_id"] not in user1_excluded_ids
    ]
    filtered_user2 = [
        s for s in user2_summaries if s["conversation_id"] not in user2_excluded_ids
    ]

    # If either user has no conversations left, return empty prompt
    if not filtered_user1 or not filtered_user2:
        return "", {}, {}

    # Build local index mappings for the LLM
    user1_idx_to_id = {}
    user2_idx_to_id = {}

    user1_texts = []
    for i, s in enumerate(filtered_user1):
        user1_idx_to_id[i] = s["conversation_id"]
        user1_texts.append(
            f"ID: {i}\nTitle: {s['title']}\nDate: {s.get('date', 'Unknown')}\nSummary: {s['summary']}"
        )

    user2_texts = []
    for j, s in enumerate(filtered_user2):
        user2_idx_to_id[j] = s["conversation_id"]
        user2_texts.append(
            f"ID: {j}\nTitle: {s['title']}\nDate: {s.get('date', 'Unknown')}\nSummary: {s['summary']}"
        )

    prompt = f"""
You are a researcher identifying serendipitous paths between conversation topics.
You'll be given conversations from two different users. Your task is to find one meaningful
connection or progression between multiple conversations from both users.

USER 1 CONVERSATIONS:
{chr(10).join(user1_texts)}

USER 2 CONVERSATIONS:
{chr(10).join(user2_texts)}

Look for a serendipitous path that connects multiple conversations from both users.
This should form an interesting progression of thought or exploration that spans across multiple conversations.

Output in this JSON format:
{{
  "user1_row_indices": [list of integer IDs from USER 1 CONVERSATIONS],
  "user2_row_indices": [list of integer IDs from USER 2 CONVERSATIONS],
  "path_description": "A detailed description of the serendipitous connection between these conversations and why they form an interesting path"
}}

Criteria for serendipitous paths:
1. Include multiple conversations from each user that connect in meaningful ways
2. Prioritize unexpected connections that might not be obvious
3. Look for thematic progression or knowledge building across the conversations
4. The conversations should form a natural sequence or network of related ideas

If you find no meaningful connections, return an empty object: {{}}
    """.strip()

    return prompt, user1_idx_to_id, user2_idx_to_id


def parse_serendipity_result(content: str) -> Dict:
    """
    Parse the LLM response (in JSON) and return a Python dictionary.
    If the JSON is invalid or empty, return an empty dict.
    """
    try:
        result = repair_json(content, return_objects=True)
        if not isinstance(result, dict):
            return {}
        return result
    except Exception:
        return {}


class SerendipitySimpleConfig(RowLimitConfig):
    # Maximum paths to return per user pair
    max_paths_per_pair: int = 10


@asset(
    partitions_def=user_partitions_def,
    ins={"conversation_summaries": AssetIn(key="conversation_summaries")},
    io_manager_key="parquet_io_manager",
)
def serendipity_simple(
    context: AssetExecutionContext,
    config: SerendipitySimpleConfig,
    gemini_flash: BaseLlmResource,
    conversation_summaries: pl.DataFrame,
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
    other_user_ids = get_materialized_partitions(context, "conversation_summaries")
    logger = context.log

    # Filter out the current user from other_user_ids if present
    other_user_ids = [uid for uid in other_user_ids if uid != current_user_id]

    if not other_user_ids:
        logger.info("No other users found for serendipitous path detection.")
        # Return an empty DataFrame with the proper schema
        return pl.DataFrame(
            schema={
                "path_id": pl.Utf8,
                "user1_id": pl.Utf8,
                "user2_id": pl.Utf8,
                "user1_conversation_ids": pl.List(pl.Utf8),
                "user2_conversation_ids": pl.List(pl.Utf8),
                "path_description": pl.Utf8,
                "iteration": pl.Int32,
                "created_at": pl.Datetime,
                "llm_output": pl.Utf8,
            }
        )

    logger.info(
        f"Processing {len(other_user_ids)} users for serendipitous paths with user {current_user_id}"
    )

    # 1) Prepare current user conversations
    # Sort by date/time for a stable ordering
    current_user_df = conversation_summaries.sort(["start_date", "start_time"])
    current_user_summaries = []
    for row in current_user_df.select(
        ["conversation_id", "title", "summary", "start_date", "start_time"]
    ).iter_rows(named=True):
        if not row["summary"]:
            continue
        date_str = "Unknown"
        if row["start_date"] and row["start_time"]:
            # Format time as HH:MM
            time_obj = row["start_time"]
            formatted_time = (
                time_obj.strftime("%H:%M")
                if hasattr(time_obj, "strftime")
                else str(time_obj)
            )
            date_str = f"{row['start_date']} {formatted_time}"
        current_user_summaries.append(
            {
                "conversation_id": row["conversation_id"],
                "title": row["title"],
                "summary": row["summary"],
                "date": date_str,
            }
        )

    # 2) For each other user, load their conversation summaries
    user_data = {}
    for user_id in other_user_ids:
        other_user_df = load_user_dataframe(user_id)
        if other_user_df.height == 0:
            logger.info(f"No valid conversations for user {user_id}, skipping.")
            continue
        sorted_other_user_df = other_user_df.sort(["start_date", "start_time"])

        other_user_summaries = []
        for row in sorted_other_user_df.select(
            ["conversation_id", "title", "summary", "start_date", "start_time"]
        ).iter_rows(named=True):
            if not row["summary"]:
                continue
            date_str = "Unknown"
            if row["start_date"] and row["start_time"]:
                time_obj = row["start_time"]
                formatted_time = (
                    time_obj.strftime("%H:%M")
                    if hasattr(time_obj, "strftime")
                    else str(time_obj)
                )
                date_str = f"{row['start_date']} {formatted_time}"

            other_user_summaries.append(
                {
                    "conversation_id": row["conversation_id"],
                    "title": row["title"],
                    "summary": row["summary"],
                    "date": date_str,
                }
            )

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
            response_text = completion[-1]  # last message is the LLM's response
            path_obj = parse_serendipity_result(response_text)

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
        return pl.DataFrame(all_paths, schema_overrides={"iteration": pl.Int32})
    else:
        # Return an empty DataFrame with the proper schema
        return pl.DataFrame(
            schema={
                "path_id": pl.Utf8,
                "user1_id": pl.Utf8,
                "user2_id": pl.Utf8,
                "user1_conversation_ids": pl.List(pl.Utf8),
                "user2_conversation_ids": pl.List(pl.Utf8),
                "path_description": pl.Utf8,
                "iteration": pl.Int32,
                "created_at": pl.Datetime,
                "llm_output": pl.Utf8,
            }
        )
