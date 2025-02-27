"""Utilities for serendipity path generation."""

from textwrap import dedent
from typing import Dict, List, Set

import numpy as np
import polars as pl
from json_repair import repair_json


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
            "common_indices": [list of integer IDs from both users' CONVERSATIONS whose themes are shared],
            "user1_unique_indices": [list of integer IDs from USER 1 CONVERSATIONS that are UNIQUE/COMPLEMENTARY to USER 2],
            "user2_unique_indices": [list of integer IDs from USER 2 CONVERSATIONS that are UNIQUE/COMPLEMENTARY to USER 1],
            "common_background": "A detailed description of the shared background between the two users (without the unique branches)",
            "unique_branches": "A detailed description of the unique branches of the serendipitous path (without the common background)"
          }}

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

        return {
            "common_indices": common_indices,
            "user1_unique_indices": user1_unique_indices,
            "user2_unique_indices": user2_unique_indices,
            "common_background": result["common_background"],
            "unique_branches": result["unique_branches"],
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


def get_empty_result_schema():
    """Return the schema for an empty serendipity results DataFrame."""
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
    }
