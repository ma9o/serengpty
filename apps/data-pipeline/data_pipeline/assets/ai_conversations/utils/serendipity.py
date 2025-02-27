"""Utilities for serendipity path generation."""

from typing import Dict, List, Set, Tuple

import polars as pl
from json_repair import repair_json


def generate_serendipity_prompt(
    user1_summaries: List[Dict],
    user2_summaries: List[Dict],
    user1_excluded_ids: Set[str] = None,
    user2_excluded_ids: Set[str] = None,
) -> Tuple[str, Dict[int, str], Dict[int, str]]:
    """
    Generate a prompt for finding serendipitous paths between two users' conversation summaries.
    The LLM sees integer indices, but we exclude by conversation UUIDs under the hood.

    Returns:
        Tuple of (prompt_text, user1_idx_to_id_map, user2_idx_to_id_map)
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
    for s in filtered_user1:
        row_idx = s["row_idx"]  # Use the stable row_idx instead of enumerate
        user1_idx_to_id[row_idx] = s["conversation_id"]
        user1_texts.append(
            f"ID: {row_idx}\nTitle: {s['title']}\nDate: {s.get('date', 'Unknown')}\nSummary: {s['summary']}"
        )

    user2_texts = []
    for s in filtered_user2:
        row_idx = s["row_idx"]  # Use the stable row_idx instead of enumerate
        user2_idx_to_id[row_idx] = s["conversation_id"]
        user2_texts.append(
            f"ID: {row_idx}\nTitle: {s['title']}\nDate: {s.get('date', 'Unknown')}\nSummary: {s['summary']}"
        )

    # Rest of the function remains the same...
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
        ["row_idx", "conversation_id", "title", "summary", "start_date", "start_time", 
         "is_sensitive", "category"]
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
        "user1_conversation_ids": pl.List(pl.Utf8),
        "user2_conversation_ids": pl.List(pl.Utf8),
        "path_description": pl.Utf8,
        "iteration": pl.Int32,
        "created_at": pl.Datetime,
        "llm_output": pl.Utf8,
    }
