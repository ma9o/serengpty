import datetime
import uuid
from typing import Dict, List, Set

import polars as pl
from dagster import AssetExecutionContext, AssetIn, asset

from data_pipeline.assets.ai_conversations.utils.serendipity import (
    generate_serendipity_prompt,
    parse_serendipity_result,
)
from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.batch_inference.base_llm_resource import BaseLlmResource


class SerendipityOptimizedConfig(RowLimitConfig):
    """Configuration for serendipity_optimized asset."""

    max_paths_per_user: int = 10

    category_ratios: Dict[str, float] = {
        "coding": 0.0,
        "humanistic": 0.7,
        "practical": 0.3,
    }


def _extract_conversation_summaries(
    df: pl.DataFrame, is_current_user: bool = False
) -> List[Dict]:
    """Extract and sort conversation summaries from a DataFrame."""
    summaries = [
        {
            "row_idx": row["row_idx"],
            "conversation_id": row["conversation_id"],
            "title": row["title"],
            "summary": row["summary"],
            "date": f"{row['start_date']} {row['start_time']}",
            "start_date": row["start_date"],
            "start_time": row["start_time"],
            **({"user_id": row["user_id"]} if not is_current_user else {}),
        }
        for row in df.iter_rows(named=True)
    ]
    return sorted(summaries, key=lambda x: (x["start_date"], x["start_time"]))


def _create_path_entry(
    path_obj: Dict,
    summaries: List[Dict],
    current_user_id: str,
    cluster_id: int,
    match_group_id: int,
    all_users: List[str],
    response_text: str,
    category: str,
    iteration: int = 0,
) -> Dict:
    """Create a path entry from an LLM response."""
    common_indices = path_obj.get("common_indices", [])
    user1_indices = path_obj.get("user1_unique_indices", [])
    user2_indices = path_obj.get("user2_unique_indices", [])

    # Identify user2 from summaries
    idx_to_user = {s["row_idx"]: s["user_id"] for s in summaries}
    user2_ids = {
        idx_to_user[idx]
        for idx in (user2_indices + common_indices)
        if idx in idx_to_user
    }
    user2_id = next(iter(user2_ids)) if user2_ids else None

    return {
        "path_id": str(uuid.uuid4()),
        "user1_id": current_user_id,
        "user2_id": user2_id,
        "common_indices": common_indices,
        "user1_indices": user1_indices,
        "user2_indices": user2_indices,
        "user1_path_length": len(user1_indices) + len(common_indices),
        "user2_path_length": len(user2_indices) + len(common_indices),
        "path_description": path_obj.get("common_background", "").strip(),
        "user1_unique_branches": path_obj.get("user_1_unique_branches", ""),
        "user2_unique_branches": path_obj.get("user_2_unique_branches", ""),
        "user1_call_to_action": path_obj.get("user_1_call_to_action", ""),
        "user2_call_to_action": path_obj.get("user_2_call_to_action", ""),
        "iteration": iteration,
        "created_at": datetime.datetime.now(),
        "llm_output": response_text,
        "user_similarity_score": 0.0,
        "cluster_id": cluster_id,
        "match_group_id": match_group_id,
        "all_user_ids": all_users,
        "category": category,
    }


def _get_out_df_schema() -> Dict:
    """Return the complete schema for the result DataFrame."""

    return {
        "path_id": pl.Utf8,
        "user1_id": pl.Utf8,
        "user2_id": pl.Utf8,
        "common_conversation_ids": pl.List(pl.Utf8),
        "user1_conversation_ids": pl.List(pl.Utf8),
        "user2_conversation_ids": pl.List(pl.Utf8),
        "path_description": pl.Utf8,
        "iteration": pl.Int32,
        "created_at": pl.Datetime,
        "llm_output": pl.Utf8,
        "user_similarity_score": pl.Float32,
        "user1_path_length": pl.Int32,
        "user2_path_length": pl.Int32,
        "cluster_id": pl.UInt8,
        "match_group_id": pl.UInt32,
        "all_user_ids": pl.List(pl.Utf8),
        "category": pl.Utf8,
        "common_indices": pl.List(pl.Int64),
        "user1_indices": pl.List(pl.Int64),
        "user2_indices": pl.List(pl.Int64),
        "user1_unique_branches": pl.Utf8,
        "user2_unique_branches": pl.Utf8,
        "user1_call_to_action": pl.Utf8,
        "user2_call_to_action": pl.Utf8,
    }


def _remap_indices_to_conversation_ids(
    paths_df: pl.DataFrame, clusters_df: pl.DataFrame
) -> pl.DataFrame:
    """Remap row indices to conversation IDs, ensuring that the number of new IDs
    (conversation IDs) matches the number of original indices.

    Raises:
        ValueError: If any index cannot be mapped to a conversation ID or if the
        resulting list length does not match the original list length.
    """
    idx_to_conv_id = dict(clusters_df.select(["row_idx", "conversation_id"]).rows())

    def remap(indices: pl.Series):
        # Convert indices to a list for processing
        original_indices = indices.to_list() if not indices.is_empty() else []
        # Map each index to a conversation id; if a conversation id is missing, raise an error.
        mapped = []
        for idx in original_indices:
            conv_id = idx_to_conv_id.get(idx)
            if conv_id is None:
                raise ValueError(
                    f"Mapping error: Conversation id for index {idx} is missing."
                )
            mapped.append(conv_id)
        # Verify that the original and mapped lists have the same length.
        if len(mapped) != len(original_indices):
            raise ValueError(
                f"Length mismatch: {len(original_indices)} original indices vs {len(mapped)} mapped conversation IDs."
            )
        return mapped

    return paths_df.with_columns(
        [
            pl.col("common_indices")
            .map_elements(remap)
            .alias("common_conversation_ids"),
            pl.col("user1_indices").map_elements(remap).alias("user1_conversation_ids"),
            pl.col("user2_indices").map_elements(remap).alias("user2_conversation_ids"),
        ]
    )


def _prepare_clusters(
    clusters_df: pl.DataFrame, current_user_id: str, logger
) -> Dict[int, Dict]:
    """Prepare cluster data from categorized conversations."""
    clusters_df = clusters_df.drop("row_idx").with_row_count("row_idx")
    if clusters_df.height == 0:
        logger.info("No conversation pairs found.")
        return {}

    cluster_data = {}
    for cluster_id, cluster_df in clusters_df.group_by("cluster_id"):
        cluster_id = cluster_id[0]
        all_users = cluster_df["user_id"].unique().to_list()
        user1_df = cluster_df.filter(pl.col("user_id") == current_user_id)
        if user1_df.height == 0:
            continue

        cluster_data[cluster_id] = {
            "current_summaries": _extract_conversation_summaries(user1_df, True),
            "summaries": _extract_conversation_summaries(
                cluster_df.filter(pl.col("user_id") != current_user_id)
            ),
            "all_users": all_users,
            "paths_found": 0,
            "iteration": 0,
            "match_group_id": cluster_df["match_group_id"][0],
            "category": cluster_df["category"][0],
        }
    logger.info(f"Prepared {len(cluster_data)} clusters.")
    return cluster_data


def _generate_paths(
    cluster_data: Dict[int, Dict],
    current_user_id: str,
    max_paths_per_cluster: int,
    gemini_flash: BaseLlmResource,
    logger,
) -> List[Dict]:
    """Generate serendipitous paths using LLM batch processing."""
    paths = []
    total_cost = 0
    exclusions: Set[int] = set()

    while True:
        prompts, cluster_ids = [], []
        for cid, data in cluster_data.items():
            if data["paths_found"] >= max_paths_per_cluster:
                continue
            if prompt := generate_serendipity_prompt(
                data["current_summaries"], data["summaries"], exclusions
            ):
                prompts.append([prompt])
                cluster_ids.append(cid)

        if not prompts:
            break

        completions, cost = gemini_flash.get_prompt_sequences_completions_batch(prompts)
        total_cost += cost
        paths_found = False

        for i, completion in enumerate(completions):
            cid = cluster_ids[i]
            data = cluster_data[cid]
            try:
                response = completion[-1]
                path_obj = parse_serendipity_result(response)
                if not isinstance(path_obj, dict):
                    continue
            except Exception as e:
                logger.warning(f"Error parsing LLM response for cluster {cid}: {e}")
                continue

            if any(
                path_obj.get(k)
                for k in [
                    "common_indices",
                    "user1_unique_indices",
                    "user2_unique_indices",
                    "common_background",
                    "user_1_unique_branches",
                    "user_2_unique_branches",
                    "user_1_call_to_action",
                    "user_2_call_to_action",
                ]
            ):
                paths_found = True
                data["paths_found"] += 1
                path = _create_path_entry(
                    path_obj,
                    data["summaries"],
                    current_user_id,
                    cid,
                    data["match_group_id"],
                    data["all_users"],
                    response,
                    data["category"],
                    data["iteration"],
                )
                paths.append(path)
                exclusions.update(
                    path_obj.get("common_indices", [])
                    + path_obj.get("user1_unique_indices", [])
                    + path_obj.get("user2_unique_indices", [])
                )
            data["iteration"] += 1

        if not paths_found:
            break

    logger.info(f"Total LLM cost: ${total_cost:.6f}")
    return paths


def _fix_duplicates(df: pl.DataFrame, logger) -> pl.DataFrame:
    """Validate and remove duplicate indices within match groups.

    For each match group (based on "match_group_id"), this function iterates over the rows,
    and for each of the list columns ["common_indices", "user1_indices", "user2_indices"],
    it removes any index that has already been encountered in that match group (keeping only the first occurrence).

    Args:
        df: DataFrame containing the path data.
        logger: Logger for recording status.

    Returns:
        A new DataFrame with duplicate indices removed.
    """
    total_removed = 0
    new_rows = []
    # Process by unique match_group_id values
    for mg_id in df["match_group_id"].unique().to_list():
        group_df = df.filter(pl.col("match_group_id") == mg_id)
        seen: set = set()
        for row in group_df.iter_rows(named=True):
            new_row = row.copy()
            for col in ["common_indices", "user1_indices", "user2_indices"]:
                new_list = []
                for item in row[col]:
                    if item in seen:
                        total_removed += 1
                    else:
                        seen.add(item)
                        new_list.append(item)
                new_row[col] = new_list
            new_rows.append(new_row)

    if total_removed == 0:
        logger.info("No duplicates found within match groups.")
    else:
        logger.info(f"Removed {total_removed} duplicate entries across match groups.")

    # Return a new DataFrame with the same schema as the original.
    return pl.DataFrame(new_rows, schema=df.schema)


@asset(
    partitions_def=user_partitions_def,
    ins={"cluster_categorizations": AssetIn(key="cluster_categorizations")},
    io_manager_key="parquet_io_manager",
)
def serendipity_optimized(
    context: AssetExecutionContext,
    config: SerendipityOptimizedConfig,
    gemini_flash: BaseLlmResource,
    cluster_categorizations: pl.DataFrame,
) -> pl.DataFrame:
    """
    Discover serendipitous paths between users' conversations using categorized clusters.

    Args:
        context: Dagster execution context.
        config: Configuration with max_paths_per_user.
        gemini_flash: LLM resource for path generation.
        cluster_categorizations: DataFrame with categorized conversation clusters.

    Returns:
        DataFrame with serendipitous path details.
    """
    current_user_id = context.partition_key
    logger = context.log

    # Prepare cluster data
    cluster_data = _prepare_clusters(cluster_categorizations, current_user_id, logger)
    if not cluster_data:
        return pl.DataFrame(schema=_get_out_df_schema())

    # Set max paths per cluster
    max_paths_per_cluster = max(1, config.max_paths_per_user // len(cluster_data))
    logger.info(f"Processing with max {max_paths_per_cluster} paths per cluster")

    # Generate paths
    paths = _generate_paths(
        cluster_data, current_user_id, max_paths_per_cluster, gemini_flash, logger
    )
    if not paths:
        return pl.DataFrame(schema=_get_out_df_schema())

    # Build and validate result DataFrame
    result_df = pl.DataFrame(paths, schema_overrides=_get_out_df_schema())
    result_df = _fix_duplicates(result_df, logger)
    result_df = _remap_indices_to_conversation_ids(result_df, cluster_categorizations)

    return result_df
