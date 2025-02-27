import datetime
import uuid

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
    # Maximum paths to return per user
    max_paths_per_user: int = 10


def _extract_conversation_summaries(df: pl.DataFrame, is_current_user: bool = False):
    """Helper function to extract conversation summaries from a dataframe."""
    summaries = []
    for row in df.iter_rows(named=True):
        conv = row["conversation"]
        summary = {
            "row_idx": conv["row_idx"],
            "conversation_id": conv["conversation_id"],
            "title": conv["title"],
            "summary": conv["summary"],
            "date": f"{conv['start_date']} {conv['start_time']}",
            "start_date": conv["start_date"],
            "start_time": conv["start_time"],
        }

        # Add user_id only for non-current users
        if not is_current_user:
            summary["user_id"] = row["user_id"]

        summaries.append(summary)

    # Sort summaries by date and time
    summaries.sort(key=lambda x: (x.get("start_date", ""), x.get("start_time", "")))
    return summaries


def _create_path_entry(
    path_obj: dict,
    user1_idx_map: dict,
    user2_idx_map: dict,
    cluster_data: dict,
    current_user_id: str,
    cluster_id: int,
    match_group_id: int,
    all_users: list,
    response_text: str,
) -> dict:
    """Create a path entry from LLM response"""
    user1_indices = path_obj.get("user1_row_indices", [])
    user2_indices = path_obj.get("user2_row_indices", [])
    path_description = path_obj.get("path_description", "")

    # Map local indices -> conversation_id
    user1_conv_ids = [
        user1_idx_map[idx] for idx in user1_indices if idx in user1_idx_map
    ]
    user2_conv_ids = [
        user2_idx_map[idx] for idx in user2_indices if idx in user2_idx_map
    ]

    # Find which user_id(s) the user2 conversations belong to
    user2_ids = set()
    for idx in user2_indices:
        if idx in user2_idx_map:
            conv_id = user2_idx_map[idx]
            # Find the user_id for this conversation
            for summary in cluster_data["summaries"]:
                if summary["conversation_id"] == conv_id:
                    user2_ids.add(summary["user_id"])
                    break

    # Convert user2_ids to list, using primary user if empty
    user2_id_list = list(user2_ids)
    primary_user2_id = user2_id_list[0] if user2_id_list else None

    # Build the path entry
    return {
        "path_id": str(uuid.uuid4()),
        "user1_id": current_user_id,
        "user2_id": primary_user2_id,
        "user1_conversation_ids": user1_conv_ids,
        "user2_conversation_ids": user2_conv_ids,
        "user1_path_length": len(user1_conv_ids),
        "user2_path_length": len(user2_conv_ids),
        "path_description": path_description,
        "iteration": cluster_data["iteration"],
        "created_at": datetime.datetime.now(),
        "llm_output": response_text,
        "user_similarity_score": 0.0,
        "cluster_id": int(cluster_id),
        "match_group_id": int(match_group_id),
        "all_user_ids": all_users,
    }


def _get_enhanced_schema():
    """Get the schema with all required fields"""
    schema = get_empty_result_schema()
    schema["user1_id"] = pl.Utf8
    schema["user_similarity_score"] = pl.Float32
    schema["user1_path_length"] = pl.Int32
    schema["user2_path_length"] = pl.Int32
    schema["cluster_id"] = pl.UInt8
    schema["match_group_id"] = pl.UInt32
    schema["all_user_ids"] = pl.List(pl.Utf8)
    return schema


@asset(
    partitions_def=user_partitions_def,
    ins={"conversation_pair_clusters": AssetIn(key="conversation_pair_clusters")},
    io_manager_key="parquet_io_manager",
)
def serendipity_optimized(
    context: AssetExecutionContext,
    config: SerendipityOptimizedConfig,
    gemini_flash: BaseLlmResource,
    conversation_pair_clusters: pl.DataFrame,
) -> pl.DataFrame:
    """
    Discovers serendipitous paths between users' conversations using pre-filtered
    conversation pairs from conversation_pair_clusters.

    This asset focuses purely on finding meaningful connections between conversation pairs
    that have already been identified as potentially related based on embedding similarity.

    Processing steps:
    1. Groups conversation pairs by cluster_id
    2. For each cluster, extracts conversation details and sorts by date and time
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
    - cluster_id (the cluster that these conversations were grouped in)
    """
    current_user_id = context.partition_key
    logger = context.log

    if conversation_pair_clusters.height == 0:
        logger.info("No conversation pair candidates found, returning empty result.")
        return pl.DataFrame(schema=_get_enhanced_schema())

    # Group by cluster_id to process each cluster separately
    cluster_groups = conversation_pair_clusters.group_by("cluster_id")
    num_clusters = cluster_groups.count().sum().get_column("count").item()

    # Calculate max paths per cluster based on total allowed paths per user and number of clusters
    # Ensure at least 1 path per cluster, but don't exceed max_paths_per_user in total
    max_paths_per_cluster = (
        max(1, config.max_paths_per_user // num_clusters)
        if num_clusters > 0
        else config.max_paths_per_user
    )
    logger.info(
        f"Processing clusters with max {max_paths_per_cluster} paths per cluster"
    )

    # Organize conversation pairs by cluster_id
    cluster_data = {}

    for cid_tuple, cluster_df in cluster_groups:
        cluster_id = cid_tuple[0]
        # Get all users in this cluster
        all_users_in_cluster = cluster_df["user_id"].unique().to_list()
        # Separate current user conversations from other users
        user1_df = cluster_df.filter(pl.col("user_id") == current_user_id)
        user2_df = cluster_df.filter(pl.col("user_id") != current_user_id)

        # Skip clusters where current user isn't present
        if user1_df.height == 0:
            continue

        # Extract summaries using helper function
        user1_summaries = _extract_conversation_summaries(
            user1_df, is_current_user=True
        )
        user2_summaries = _extract_conversation_summaries(user2_df)

        # Get the match_group_id for this cluster (for user similarity reference)
        match_group_id = cluster_df["match_group_id"][0] if cluster_df.height > 0 else 0

        # Store data for this cluster
        cluster_data[cluster_id] = {
            "current_summaries": user1_summaries,
            "summaries": user2_summaries,
            "all_users": all_users_in_cluster,
            "excluded_ids_user1": set(),  # conversation_id's from current user
            "excluded_ids_user2": set(),  # conversation_id's from other users
            "paths_found": 0,
            "iteration": 0,
            "match_group_id": match_group_id,
        }

    logger.info(f"Processing {len(cluster_data)} clusters for serendipitous paths")

    # Iteratively find paths across clusters
    all_paths = []
    total_cost = 0

    while True:
        prompt_sequences = []
        cluster_info = []

        # Generate prompts for each cluster that hasn't reached max_paths
        for cluster_id, data in cluster_data.items():
            if data["paths_found"] >= max_paths_per_cluster:
                continue

            # Use the summaries specific to this cluster
            prompt, user1_idx_map, user2_idx_map = generate_serendipity_prompt(
                data["current_summaries"],
                data["summaries"],
                user1_excluded_ids=data["excluded_ids_user1"],
                user2_excluded_ids=data["excluded_ids_user2"],
            )

            if prompt:
                # We'll store the index mappings so we can decode the LLM response later
                prompt_sequences.append([prompt])
                cluster_info.append(
                    {
                        "cluster_id": cluster_id,
                        "user1_idx_map": user1_idx_map,
                        "user2_idx_map": user2_idx_map,
                        "all_users": data["all_users"],
                        "match_group_id": data["match_group_id"],
                    }
                )

        if not prompt_sequences:
            # No more prompts to process → break out
            break

        # Get batch completions from the LLM
        completions, cost = gemini_flash.get_prompt_sequences_completions_batch(
            prompt_sequences
        )
        total_cost += cost

        # Process each LLM response
        paths_found_any = False
        for i, completion in enumerate(completions):
            cluster_id = cluster_info[i]["cluster_id"]
            user1_idx_map = cluster_info[i]["user1_idx_map"]
            user2_idx_map = cluster_info[i]["user2_idx_map"]
            all_users = cluster_info[i]["all_users"]
            match_group_id = cluster_info[i]["match_group_id"]
            cluster_info_data = cluster_data[cluster_id]

            # Parse the JSON from the LLM
            try:
                response_text = completion[-1]  # last message is the LLM's response
                path_obj = parse_serendipity_result(response_text)
            except (IndexError, Exception) as e:
                logger.warning(
                    f"Error processing LLM response for cluster {cluster_id}: {str(e)}"
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
                cluster_info_data["paths_found"] += 1

                # Create path entry using helper function
                path_entry = _create_path_entry(
                    path_obj,
                    user1_idx_map,
                    user2_idx_map,
                    cluster_info_data,
                    current_user_id,
                    cluster_id,
                    match_group_id,
                    all_users,
                    response_text,
                )
                all_paths.append(path_entry)

                # Map indices to conversation IDs for exclusion
                user1_conv_ids = [
                    user1_idx_map[idx] for idx in user1_indices if idx in user1_idx_map
                ]
                user2_conv_ids = [
                    user2_idx_map[idx] for idx in user2_indices if idx in user2_idx_map
                ]

                # Exclude these conversation IDs from subsequent prompts
                cluster_info_data["excluded_ids_user1"].update(user1_conv_ids)
                cluster_info_data["excluded_ids_user2"].update(user2_conv_ids)

            # Increment iteration for the cluster
            cluster_info_data["iteration"] += 1

        # If in this entire batch we found no paths, there's no need to continue
        if not paths_found_any:
            break

    logger.info(f"Total cost of LLM calls: ${total_cost:.6f}")

    # Build the final result DataFrame
    if all_paths:
        result_df = pl.DataFrame(
            all_paths,
            schema_overrides={
                "iteration": pl.Int32,
                "user_similarity_score": pl.Float32,
                "user1_path_length": pl.Int32,
                "user2_path_length": pl.Int32,
                "cluster_id": pl.UInt8,
                "match_group_id": pl.UInt32,
                "all_user_ids": pl.List(pl.Utf8),
            },
        )

        context.log.info(f"Result DataFrame: {result_df.head()}")

        # Assert that there are no duplicates within each match_group_id
        user1_exploded = (
            result_df.select("match_group_id", "user1_conversation_ids")
            .explode("user1_conversation_ids")
            .rename({"user1_conversation_ids": "conversation_id"})
        )

        user2_exploded = (
            result_df.select("match_group_id", "user2_conversation_ids")
            .explode("user2_conversation_ids")
            .rename({"user2_conversation_ids": "conversation_id"})
        )

        # Concatenate and group by match_group_id
        all_exploded = pl.concat([user1_exploded, user2_exploded])

        # Check for duplicates within each match group
        total_duplicates = 0
        for match_group_id in all_exploded["match_group_id"].unique():
            group_df = all_exploded.filter(pl.col("match_group_id") == match_group_id)
            group_unique = group_df.select("conversation_id").unique()
            duplicates = group_df.height - group_unique.height
            if duplicates > 0:
                logger.error(
                    f"Found {duplicates} duplicate conversation IDs within match_group_id {match_group_id}"
                )
                total_duplicates += duplicates

        if total_duplicates > 0:
            logger.error(
                f"Found {total_duplicates} total duplicate conversation IDs across all match groups"
            )
        else:
            logger.info("No duplicate conversation IDs found within any match group")

        return result_df
    else:
        # Return an empty DataFrame with the proper schema
        return pl.DataFrame(schema=_get_enhanced_schema())
