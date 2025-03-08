"""Utilities for serendipity path generation."""

import math
from textwrap import dedent
from typing import Dict, List, Set

import numpy as np
import polars as pl
from json_repair import repair_json

from .find_top_k_users import get_approx_user_sim


def generate_serendipity_prompt(
    user1_summaries: List[Dict],
    user2_summaries: List[Dict],
    excluded_indices: Set[int] = None,
) -> str:
    """
    Generate a prompt for finding serendipitous paths between two users' conversation summaries.
    The LLM directly uses the row_idx values from the summaries.

    Uses a single global exclusion set for all row indices.

    Returns:
        prompt_text: The generated prompt
    """
    if excluded_indices is None:
        excluded_indices = set()

    # Filter out conversations whose row_idx is in the excluded set
    filtered_user1 = [
        s for s in user1_summaries if s["row_idx"] not in excluded_indices
    ]
    filtered_user2 = [
        s for s in user2_summaries if s["row_idx"] not in excluded_indices
    ]

    # If either user has no conversations left, return empty prompt
    if not filtered_user1 or not filtered_user2:
        return ""

    user1_texts = []
    for s in filtered_user1:
        row_idx = s["row_idx"]
        user1_texts.append(
            f"ID: {row_idx}\nTitle: {s['title']}\nDate: {s.get('date', 'Unknown')}\nSummary: {s['summary']}"
        )

    user2_texts = []
    for s in filtered_user2:
        row_idx = s["row_idx"]
        user2_texts.append(
            f"ID: {row_idx}\nTitle: {s['title']}\nDate: {s.get('date', 'Unknown')}\nSummary: {s['summary']}"
        )

    # Rest of the function remains the same...
    prompt = dedent(
        f"""
          You'll be given summaries of AI conversations from two different users.
          Your task is to find the best matching serendipitous progression between the two users, that spans across multiple conversations in either set.

          The serendipitous path should have common nodes (the conversations) that establish a closely shared background, but it should branch out into unique nodes that are complementary to either user.
          Common nodes between the two users should be as closely matched as possible, and the divergent paths have to be at least tangentially related to the common background.

          Output in this JSON format:
          {{
            "path_title": "A concise, engaging title for this serendipitous path that captures the essence of the connection. Add an emoji at the beginning of the title.",
            "common_indices": [list of integer IDs from both users' CONVERSATIONS whose themes are shared],
            "user1_unique_indices": [list of integer IDs from USER 1 CONVERSATIONS that explore topics unique to USER 1, not present in USER 2],
            "user2_unique_indices": [list of integer IDs from USER 2 CONVERSATIONS that explore topics unique to USER 2, not present in USER 1],
            "common_background": "A detailed description of the shared background between the two users (without the unique parts)",
            "user_1_unique_branches": "A summary of the unique path undertaken by USER 1",
            "user_2_unique_branches": "A summary of the unique path undertaken by USER 2",
            "user_1_call_to_action": "A short prompt describing what USER 1 should ask USER 2, given their differences and similarities",
            "user_2_call_to_action": "A short prompt describing what USER 2 should ask USER 1, given their differences and similarities",
            "is_highly_sensitive": "Boolean value indicating whether the path contains highly sensitive content: physical and mental health problems, erotic content, etc."
          }}

          In the text, replace any references to the users with "<USER_1>" and "<USER_2>".

          If you cannot find a serendipitous path, return an empty object: {{}}

          USER 1 CONVERSATIONS:
          {chr(10).join(user1_texts)}

          USER 2 CONVERSATIONS:
          {chr(10).join(user2_texts)}
        """.strip()
    )

    return prompt


def parse_serendipity_result(content: str) -> Dict:
    """
    Parse the LLM response (in JSON) and return a Python dictionary.
    If the JSON is invalid or empty, return an empty dict.
    """
    try:
        result = repair_json(content, return_objects=True)
        if not isinstance(result, dict):
            return {}

        # LLM might return duplicate indices, so we need to remove them
        common_indices = np.unique(result["common_indices"]).tolist()

        # Make sure unique indices don't overlap with common indices
        user1_unique_indices = list(
            set(np.unique(result["user1_unique_indices"])) - set(common_indices)
        )
        user2_unique_indices = list(
            set(np.unique(result["user2_unique_indices"]))
            - set(user1_unique_indices)  # Just to be sure
            - set(common_indices)
        )

        # If any of these lists are empty, the path doesnt make sense
        if (
            len(common_indices) == 0
            or len(user1_unique_indices) == 0
            or len(user2_unique_indices) == 0
        ):
            return {}
        else:
            return {
                "path_title": result.get("path_title", "Serendipitous Connection"),
                "common_indices": common_indices,
                "user1_unique_indices": user1_unique_indices,
                "user2_unique_indices": user2_unique_indices,
                "common_background": result["common_background"],
                "user_1_unique_branches": result.get("user_1_unique_branches", ""),
                "user_2_unique_branches": result.get("user_2_unique_branches", ""),
                "user_1_call_to_action": result.get("user_1_call_to_action", ""),
                "user_2_call_to_action": result.get("user_2_call_to_action", ""),
                "is_highly_sensitive": result.get("is_highly_sensitive", False),
            }
    except Exception:
        return {}


def format_conversation_summary(row: Dict) -> Dict:
    """
    Format a conversation row into a summary dictionary.

    Args:
        row: A row from the conversation DataFrame

    Returns:
        A dictionary with conversation details
    """
    if not row["summary"]:
        return None

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

    return {
        "conversation_id": row["conversation_id"],
        "title": row["title"],
        "summary": row["summary"],
        "date": date_str,
        "is_sensitive": row.get("is_sensitive", False),
        "category": row.get("category", "practical"),
    }


def prepare_conversation_summaries(df: pl.DataFrame) -> List[Dict]:
    """
    Prepare conversation summaries from a DataFrame.

    Args:
        df: A polars DataFrame with conversation data

    Returns:
        A list of conversation summary dictionaries
    """
    # Add row indices before sorting
    df_with_idx = df.with_row_count("row_idx")

    # Sort by date/time for a stable ordering
    sorted_df = df_with_idx.sort(["start_date", "start_time"])

    summaries = []
    for row in sorted_df.select(
        [
            "row_idx",
            "conversation_id",
            "title",
            "summary",
            "start_date",
            "start_time",
            "is_sensitive",
            "category",
        ]
    ).iter_rows(named=True):
        summary = format_conversation_summary(row)
        if summary:
            # Include the row_idx in the summary
            summary["row_idx"] = row["row_idx"]
            summaries.append(summary)

    return summaries


def get_out_df_schema() -> Dict:
    """Return the complete schema for the result DataFrame."""

    return {
        "path_id": pl.Utf8,
        "user1_id": pl.Utf8,
        "user2_id": pl.Utf8,
        "path_title": pl.Utf8,
        "common_conversation_ids": pl.List(pl.Utf8),
        "user1_conversation_ids": pl.List(pl.Utf8),
        "user2_conversation_ids": pl.List(pl.Utf8),
        "path_description": pl.Utf8,
        "iteration": pl.Int32,
        "created_at": pl.Datetime,
        "llm_output": pl.Utf8,
        "user1_path_length": pl.Int32,
        "user2_path_length": pl.Int32,
        "cluster_id": pl.UInt8,
        "match_group_id": pl.UInt32,
        "category": pl.Utf8,
        "common_indices": pl.List(pl.Int64),
        "user1_indices": pl.List(pl.Int64),
        "user2_indices": pl.List(pl.Int64),
        "user1_unique_branches": pl.Utf8,
        "user2_unique_branches": pl.Utf8,
        "user1_call_to_action": pl.Utf8,
        "user2_call_to_action": pl.Utf8,
        "is_highly_sensitive": pl.Boolean,
        "balance_score": pl.Float64,
        "balance_scores_detailed": pl.Struct(
            {
                "imbalance": pl.Float64,
                "magnitude_factor": pl.Float64,
                "dist": pl.Float64,
            }
        ),
    }


def remap_indices_to_conversation_ids(
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


def calculate_balance_scores(
    data: Dict,
    exclusions: Set[int],
) -> tuple[float, Dict[str, float]]:
    """Calculate balance score based on remaining conversations.

    Returns a score that prioritizes:
    1. Larger total number of conversations
    2. More balanced ratio between sides
    Lower scores are better.
    """
    embeddings_current = [
        s["embedding"]
        for s in data["current_summaries"]
        if s["row_idx"] not in exclusions
    ]
    embeddings_other = [
        s["embedding"] for s in data["summaries"] if s["row_idx"] not in exclusions
    ]
    len_current = len(embeddings_current)
    len_other = len(embeddings_other)
    if len_other == 0 or len_current == 0:
        return float("inf"), {}  # Deprioritize if either side has no conversations

    # Calculate imbalance penalty (smaller is better)
    ratio = len_current / len_other
    imbalance = abs(math.log(ratio))

    # Calculate magnitude bonus (larger total is better)
    total_conversations = len_current + len_other
    magnitude_factor = 1 / total_conversations  # Inverse so smaller is better

    # Calculate cosine similarity between embeddings
    sim = get_approx_user_sim(np.array(embeddings_current), np.array(embeddings_other))
    dist = 1 - sim

    return imbalance + magnitude_factor + dist, {
        "imbalance": imbalance,
        "magnitude_factor": magnitude_factor,
        "dist": dist,
    }
