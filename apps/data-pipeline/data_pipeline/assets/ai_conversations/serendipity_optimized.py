import asyncio
import datetime
import traceback
import uuid
from collections import defaultdict
from math import ceil
from typing import Dict, List, Set, cast

import numpy as np
import polars as pl
from dagster import AssetExecutionContext, AssetIn, asset
from sklearn.discriminant_analysis import StandardScaler

from data_pipeline.assets.ai_conversations.utils.balance_scores import (
    calculate_balance_scores,
    sum_balance_scores,
)
from data_pipeline.assets.ai_conversations.utils.load_user_dataframe import (
    load_user_dataframe,
)
from data_pipeline.assets.ai_conversations.utils.serendipity import (
    generate_serendipity_prompt,
    get_out_df_schema,
    parse_serendipity_result,
    remap_indices_to_conversation_ids,
)
from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.batch_inference.base_llm_resource import BaseLlmResource


class SerendipityOptimizedConfig(RowLimitConfig):
    """Configuration for serendipity_optimized asset."""

    max_paths_per_match_group: int = 20

    match_group_category_ratios: Dict[str, float] = {
        "coding": 0.0,
        "humanistic": 0.7,
        "practical": 0.3,
    }


def _extract_conversation_summaries(
    df: pl.DataFrame,
    parsed_conversations: pl.DataFrame = None,
    is_current_user: bool = False,
) -> List[Dict]:
    """Extract and sort conversation summaries from a DataFrame."""
    # Extract human questions from parsed_conversations if provided
    raw_questions_by_conv = {}
    if parsed_conversations is not None:
        # Create a DataFrame with sorted questions for each conversation_id
        questions_df = parsed_conversations.select(
            ["conversation_id", "date", "time", "question"]
        ).sort(["conversation_id", "date", "time"])

        # Group by conversation_id and collect questions
        for group, rows in questions_df.group_by("conversation_id"):
            conv_id = group[0]
            questions = [row["question"] for row in rows.iter_rows(named=True)]
            raw_questions_by_conv[conv_id] = questions

    summaries = []
    for row in df.iter_rows(named=True):
        conv_id = row["conversation_id"]
        summary_dict = {
            "row_idx": row["row_idx"],
            "conversation_id": conv_id,
            "title": row["title"],
            "summary": row["summary"],
            "date": f"{row['start_date']} {row['start_time']}",
            "start_date": row["start_date"],
            "start_time": row["start_time"],
            "embedding": row["embedding"],
            "raw_questions": raw_questions_by_conv.get(conv_id, []),
            **({"user_id": row["user_id"]} if not is_current_user else {}),
        }
        summaries.append(summary_dict)

    return sorted(summaries, key=lambda x: (x["start_date"], x["start_time"]))


def _create_path_entry(
    path_obj: Dict,
    summaries: List[Dict],
    current_user_id: str,
    cluster_id: int,
    match_group_id: int,
    response_text: str,
    category: str,
    iteration: int = 0,
    balance_score: float = 0.0,
    balance_scores_detailed: Dict[str, float] = {},
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
        "path_title": path_obj.get("path_title", "Serendipitous Connection"),
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
        "cluster_id": cluster_id,
        "match_group_id": match_group_id,
        "category": category,
        "is_sensitive": path_obj.get("is_sensitive", False),
        "balance_score": balance_score,
        "balance_scores_detailed": balance_scores_detailed,
    }


def _prepare_clusters(
    clusters_df: pl.DataFrame,
    current_user_id: str,
    parsed_conversations: pl.DataFrame,
    logger,
) -> Dict[int, Dict]:
    """Prepare cluster data from categorized conversations."""
    if clusters_df.height == 0:
        logger.info("No conversation pairs found.")
        return {}

    # Cache for other users' parsed conversations
    other_users_parsed_conv_cache = {}

    cluster_data = {}
    for cluster_id, cluster_df in clusters_df.group_by("cluster_id"):
        cluster_id = cluster_id[0]
        user1_df = cluster_df.filter(pl.col("user_id") == current_user_id)
        if user1_df.height == 0:
            continue

        # Get other users' data
        other_users_df = cluster_df.filter(pl.col("user_id") != current_user_id)

        # Get unique other user IDs
        other_user_ids = other_users_df.select("user_id").unique().to_series().to_list()

        # Load parsed conversations for other users
        other_users_parsed_convs = []
        for user_id in other_user_ids:
            if user_id not in other_users_parsed_conv_cache:
                try:
                    # Load this user's parsed conversations
                    user_parsed_conv = load_user_dataframe(
                        user_id, "parsed_conversations"
                    )
                    other_users_parsed_conv_cache[user_id] = user_parsed_conv
                except Exception as e:
                    logger.warning(
                        f"Could not load parsed conversations for user {user_id}: {e}"
                    )
                    other_users_parsed_conv_cache[user_id] = None

            if other_users_parsed_conv_cache[user_id] is not None:
                other_users_parsed_convs.append(other_users_parsed_conv_cache[user_id])

        # Combine all other users' parsed conversations
        other_users_parsed_conv = (
            pl.concat(other_users_parsed_convs) if other_users_parsed_convs else None
        )

        cluster_data[cluster_id] = {
            "current_summaries": _extract_conversation_summaries(
                user1_df, parsed_conversations, True
            ),
            "summaries": _extract_conversation_summaries(
                other_users_df, other_users_parsed_conv
            ),
            "paths_found": 0,
            "iteration": 0,
            "match_group_id": cluster_df["match_group_id"][0],
            "category": cluster_df["category"][0],
        }
    logger.info(f"Prepared {len(cluster_data)} clusters.")
    return cluster_data


async def _generate_paths(
    cluster_data: Dict[int, Dict],
    current_user_id: str,
    llm: BaseLlmResource,
    logger,
    config: SerendipityOptimizedConfig,
) -> List[Dict]:
    """
    Generate serendipitous paths using LLM sequentially, balancing by category ratios
    and dynamically prioritizing clusters by the ratio of remaining conversations closest to 1.
    """
    paths_by_category = defaultdict(list)
    total_cost = 0
    exclusions: Set[int] = set()

    # Group clusters by category and filter by positive category ratios
    category_to_clusters = {}
    for cid, data in cluster_data.items():
        category = data["category"]
        if config.match_group_category_ratios.get(category, 0.0) > 0:
            if category not in category_to_clusters:
                category_to_clusters[category] = []
            category_to_clusters[category].append(cid)

    # Sort categories by their ratios in descending order
    sorted_categories = sorted(
        category_to_clusters.keys(),
        key=lambda c: config.match_group_category_ratios[c],
        reverse=True,
    )
    if not sorted_categories:
        logger.info("No categories with positive ratios found.")
        return []

    # Process each category sequentially
    for category in sorted_categories:
        initial_cluster_ids = category_to_clusters[category]
        if not initial_cluster_ids:
            continue

        # Initialize scaler for current category
        initial_scores = [
            calculate_balance_scores(cluster_data[cid], exclusions)[1]
            for cid in initial_cluster_ids
        ]

        # Filter out inf scores
        valid_entries = []
        for i, score in enumerate(initial_scores):
            if not any(v == float("inf") for v in score.values()):
                valid_entries.append((i, score))

        # Keep only valid cluster ids and their scores
        valid_cluster_ids = [initial_cluster_ids[i] for i, _ in valid_entries]
        valid_scores = [score for _, score in valid_entries]

        if not valid_scores:
            continue  # Skip this category if no valid scores

        scaler = StandardScaler()
        standardized_metrics = scaler.fit_transform(
            np.column_stack(
                [
                    [x["imbalance"] for x in valid_scores],
                    [x["magnitude_factor"] for x in valid_scores],
                    [x["dist"] for x in valid_scores],
                ]
            )
        )

        # Initialize active clusters with their current balance scores
        active_clusters = [
            (
                cid,
                sum_balance_scores(*standardized_metrics[i]),
                {
                    "imbalance": standardized_metrics[i][0],
                    "magnitude_factor": standardized_metrics[i][1],
                    "dist": standardized_metrics[i][2],
                },
            )
            for i, cid in enumerate(valid_cluster_ids)
        ]

        # Process clusters dynamically within this category
        while (
            active_clusters  # There are still clusters to process
            and (  # We haven't reached the max number of paths per match group
                sum(len(paths) for paths in paths_by_category.values())
                < config.max_paths_per_match_group
            )
            and (  # We haven't reached the max number of paths per category
                len(paths_by_category[category])
                < ceil(
                    config.max_paths_per_match_group
                    * config.match_group_category_ratios[category]
                )
            )
        ):
            # Sort by balance score and select the top cluster
            active_clusters.sort(
                key=lambda x: x[1]
            )  # Smallest score (closest to 1) first
            cid, balance_score, balance_scores_detailed = active_clusters[
                0
            ]  # Get the top cluster
            data = cluster_data[cid]

            # Generate prompt with remaining conversations
            prompt = generate_serendipity_prompt(
                data["current_summaries"], data["summaries"], exclusions
            )
            if not prompt:
                # Cluster can't generate more paths; remove it
                active_clusters.pop(0)
                continue

            # Generate path (batch size of 1)
            (
                completions,
                cost,
            ) = await llm.get_prompt_sequences_completions_batch_async([[prompt]])
            total_cost += cost
            completion = completions[0]

            path_obj, indices_to_exclude = parse_serendipity_result(completion[-1])

            # Update exclusions, regardless of whether parsing was successful
            exclusions.update(indices_to_exclude)

            if not path_obj:
                continue

            # Create and store the path
            path = _create_path_entry(
                path_obj,
                data["summaries"],
                current_user_id,
                cid,
                data["match_group_id"],
                completion[-1],
                data["category"],
                data["iteration"],
                balance_score,
                balance_scores_detailed,
            )
            paths_by_category[category].append(path)

            data["iteration"] += 1

            # Recalculate balance score for this cluster
            new_balance_score, new_scores_detailed = calculate_balance_scores(
                data, exclusions
            )
            if new_balance_score == float("inf"):
                # No remaining conversations; remove cluster
                active_clusters.pop(0)
            else:
                # Scale with the same scaler
                new_standardized_metrics = scaler.transform(
                    np.array(
                        [
                            [
                                new_scores_detailed["imbalance"],
                                new_scores_detailed["magnitude_factor"],
                                new_scores_detailed["dist"],
                            ]
                        ]
                    )
                )
                new_standardized_metrics = cast(np.ndarray, new_standardized_metrics)
                new_balance_score = sum_balance_scores(*new_standardized_metrics[0])
                # Update the cluster's score in the list
                active_clusters[0] = (
                    cid,
                    new_balance_score,
                    {
                        "imbalance": new_standardized_metrics[0][0],
                        "magnitude_factor": new_standardized_metrics[0][1],
                        "dist": new_standardized_metrics[0][2],
                    },
                )

        if not active_clusters:
            logger.info(f"Category '{category}' exhausted.")

    logger.info(f"Total LLM cost: ${total_cost:.6f}")
    return [path for paths in paths_by_category.values() for path in paths]


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
    ins={
        "cluster_categorizations": AssetIn(key="cluster_categorizations"),
        "parsed_conversations": AssetIn(key="parsed_conversations"),
    },
    io_manager_key="parquet_io_manager",
)
async def serendipity_optimized(
    context: AssetExecutionContext,
    config: SerendipityOptimizedConfig,
    gemini_flash: BaseLlmResource,
    cluster_categorizations: pl.DataFrame,
    parsed_conversations: pl.DataFrame,
) -> pl.DataFrame:
    """
    Discover serendipitous paths between users' conversations using categorized clusters.

    Args:
        context: Dagster execution context.
        config: Configuration with max_paths_per_match_group.
        gemini_flash: LLM resource for path generation.
        cluster_categorizations: DataFrame with categorized conversation clusters.
        parsed_conversations: DataFrame with original conversation data including questions.

    Returns:
        DataFrame with serendipitous path details.
    """
    current_user_id = context.partition_key
    logger = context.log

    clusters_df = cluster_categorizations.drop("row_idx").with_row_count("row_idx")

    # Prepare cluster data
    cluster_data = _prepare_clusters(
        clusters_df, current_user_id, parsed_conversations, logger
    )
    if not cluster_data:
        return pl.DataFrame(schema=get_out_df_schema())

    # Group the cluster_data by their match_group_id
    match_group_data: Dict[int, Dict] = {}
    for cid, data in cluster_data.items():
        mg_id = data["match_group_id"]
        if mg_id not in match_group_data:
            match_group_data[mg_id] = {}
        match_group_data[mg_id][cid] = data

    # Generate paths in parallel using asyncio (one task per match_group_id)
    paths: List[Dict] = []
    tasks = []
    for mg_id, group_data in match_group_data.items():
        task = asyncio.create_task(
            _generate_paths(
                group_data,
                current_user_id,
                gemini_flash,
                logger,
                config,
            )
        )
        tasks.append((mg_id, task))

    for mg_id, task in tasks:
        try:
            group_paths = await task
            if group_paths:
                paths.extend(group_paths)
        except Exception as e:
            logger.error(f"Error processing match group {mg_id}: {e}")
            logger.error(f"Error details: {traceback.format_exc()}")

    if not paths:
        return pl.DataFrame(schema=get_out_df_schema())

    # Build and validate result DataFrame
    result_df = pl.DataFrame(paths, schema_overrides=get_out_df_schema(), strict=False)

    result_df = _fix_duplicates(result_df, logger)
    result_df = remap_indices_to_conversation_ids(result_df, clusters_df)

    return result_df
