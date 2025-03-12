from textwrap import dedent
from typing import Dict, List

import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    asset,
)
from json_repair import repair_json

from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.batch_inference.base_llm_resource import (
    BaseLlmResource,
    PromptSequence,
)


class ClusterCategorizationsConfig(RowLimitConfig):
    # Maximum number of conversations to sample per cluster for categorization
    max_sample_per_cluster: int = 10


def get_cluster_categorization_prompt_sequence(
    conversations: List[Dict],
) -> PromptSequence:
    """Generate a prompt to categorize a cluster of conversations."""
    formatted_conversations = []

    for i, conv in enumerate(conversations, 1):
        formatted_conversations.append(
            f"CONVERSATION {i}:\nTitle: {conv['title']}\nSummary: {conv['summary']}"
        )

    conversations_text = "\n\n".join(formatted_conversations)

    return [
        dedent(
            f"""
            You will be given a set of conversation summaries that have been grouped together based on their semantic similarity.
            Your task is to categorize this cluster of conversations by its domain as either "coding", "humanistic" or "practical".

            Definitions:
            - "humanistic": Focus on values, beliefs, and worldviews. Invite vulnerability and self-disclosure, with high shareability potential.
            - "coding": Topics related to programming, software development, coding languages, debugging, etc. This category takes precedence over "practical".
            - "practical": Task focused conversations. Everything else that is less personal or emotionally revealing.

            First analyze each conversation and then determine the overarching theme of the cluster.
            IMPORTANT: If the conversations are related to coding or programming, you MUST categorize as "coding" even if they could also fit into another category.

            At the end of your analysis, output the following JSON:
            {{
                "category": str,
            }}

            Here are the conversations:
            {conversations_text}
            """
        ).strip(),
    ]


def parse_cluster_categorization(completion: str) -> dict:
    """Parse the LLM's cluster categorization response and return the category."""
    try:
        res = repair_json(completion, return_objects=True)

        if (
            isinstance(res, dict)
            and "category" in res
            and isinstance(res["category"], str)
            and res["category"].lower() in ["coding", "humanistic", "practical"]
        ):
            return {
                "category": res["category"].lower(),
            }
        else:
            # Default to practical if parsing fails
            return {
                "category": "practical",
            }
    except Exception:
        # Default to practical if parsing fails
        return {
            "category": "practical",
        }


@asset(
    partitions_def=user_partitions_def,
    ins={"conversation_pair_clusters": AssetIn(key="conversation_pair_clusters")},
    io_manager_key="parquet_io_manager",
    # pool="gpt4o_mini",
)
async def cluster_categorizations(
    context: AssetExecutionContext,
    config: ClusterCategorizationsConfig,
    gpt4o_mini: BaseLlmResource,
    conversation_pair_clusters: pl.DataFrame,
) -> pl.DataFrame:
    """
    Add category information to conversation_pair_clusters by analyzing cluster content.

    This asset:
    1. Groups conversation pairs by cluster_id
    2. For each cluster, samples up to max_sample_per_cluster conversations
    3. Uses an LLM to categorize the cluster as either "humanistic" or "practical"
    4. Adds the category directly to the input conversation_pair_clusters data

    The categorization is done at the cluster level (rather than individual conversations)
    to ensure consistency across related conversations and reduce LLM usage.

    Configuration options:
    - max_sample_per_cluster: Maximum number of conversations to sample per cluster (default: 10)

    Returns the original conversation_pair_clusters DataFrame with an added "category" column.
    """
    current_user_id = context.partition_key
    logger = context.log

    if conversation_pair_clusters.height == 0:
        logger.info("No conversation clusters found, returning empty result.")
        # Return empty DataFrame with category column added
        return conversation_pair_clusters.with_columns(
            pl.lit("practical").alias("category")
        )

    # Group by cluster_id
    cluster_groups = conversation_pair_clusters.group_by("cluster_id")
    clusters_count = cluster_groups.count().height

    logger.info(f"Categorizing {clusters_count} clusters for user {current_user_id}")

    # Lists to store prompt sequences and corresponding cluster_ids
    all_prompt_sequences = []
    cluster_ids = []

    for (cluster_id,), cluster_df in cluster_groups:
        # Sample conversations from this cluster for categorization
        # We'll use a random sample if we have more than max_sample_per_cluster conversations
        if cluster_df.height > config.max_sample_per_cluster:
            # Create a random sample
            sampled_df = cluster_df.sample(config.max_sample_per_cluster)
        else:
            sampled_df = cluster_df

        # Prepare sample conversations for categorization
        sample_conversations = []

        for row in sampled_df.select("title", "summary").iter_rows(named=True):
            sample_conversations.append(
                {"title": row["title"], "summary": row["summary"]}
            )

        # Only prepare prompt if we have sample conversations
        if sample_conversations:
            # Generate prompt for categorization
            prompt_sequence = get_cluster_categorization_prompt_sequence(
                sample_conversations
            )

            # Store prompt and corresponding cluster_id
            all_prompt_sequences.append(prompt_sequence)
            # Ensure cluster_id is an integer
            if isinstance(cluster_id, (int, float, str)):
                cluster_ids.append(int(cluster_id))
            else:
                # Log a warning and skip this cluster if cluster_id can't be converted to int
                logger.warning(
                    f"Skipping cluster with non-convertible cluster_id: {cluster_id}"
                )

    # Dictionary to store cluster_id -> category mapping
    cluster_results = {}

    # Only make LLM call if we have prompts to process
    if all_prompt_sequences:
        # Get LLM completions for all clusters in a single batch call
        (
            completions,
            total_cost,
        ) = await gpt4o_mini.get_prompt_sequences_completions_batch_async(
            all_prompt_sequences
        )

        logger.info(f"Total cost of LLM calls: ${total_cost:.6f}")

        # Process completions and map them to cluster IDs
        for i, (cluster_id, completion) in enumerate(zip(cluster_ids, completions)):
            if completion:
                # Parse the categorization result
                result = parse_cluster_categorization(completion[-1])
            else:
                # Default categorization if LLM call fails
                result = {"category": "practical"}
                logger.warning(f"Failed to get categorization for cluster {cluster_id}")

            # Store the category for this cluster
            cluster_results[cluster_id] = result
    else:
        logger.info("No prompts to process")

    # Add the category column to the original DataFrame
    if cluster_results:
        result_df = conversation_pair_clusters.with_columns(
            [
                pl.when(pl.col("cluster_id").is_in(list(cluster_results.keys())))
                .then(
                    pl.col("cluster_id").map_elements(
                        lambda x: cluster_results[x]["category"]
                    )
                )
                .otherwise(pl.lit("practical"))
                .alias("category"),
            ]
        )

        logger.info(f"Added categories to {len(cluster_results)} clusters")
        return result_df
    else:
        # If no categories were found, add default category
        logger.info("No categories found, adding default category")
        return conversation_pair_clusters.with_columns(
            [
                pl.lit("practical").alias("category"),
            ]
        )
