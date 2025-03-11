"""Utilities for serendipity path generation."""

from textwrap import dedent
from typing import Dict, List, Set

import numpy as np
import polars as pl
from json_repair import repair_json


def _prepare_user_texts(user_summaries: List[Dict], excluded_indices: Set[int]) -> str:
    filtered_summaries = [
        s for s in user_summaries if s["row_idx"] not in excluded_indices
    ]
    texts = []
    for s in filtered_summaries:
        row_idx = s["row_idx"]
        # Format human questions if they exist
        questions_section = ""
        if s.get("human_questions") and len(s["human_questions"]) > 0:
            questions = s["human_questions"]
            questions_text = "\n  - ".join([q for q in questions if q])
            questions_section = f"\nQuestions Asked:\n  - {questions_text}"

        texts.append(
            f"ID: {row_idx}\nTitle: {s['title']}\nDate: {s.get('date', 'Unknown')}\nSummary: {s['summary']}{questions_section}\n"
        )

    return chr(10).join(texts)


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

    return dedent(
        f"""
          You'll be given two lists of conversations between two users and AI assistants.
          Your task is to find a serendipitous path between them, linking multiple conversations from each set.

          The connection must include:
          - **Common nodes**: Conversations with closely matching themes that form a shared foundation.
          - **Unique nodes**: Complementary branches that diverge into distinct but related areas.

          Focus on the the users' original questions and what they want to achieve.
          In your outputs, assume the users are expert in the topics they are discussing so avoid any generalizations and be as specific as possible.

          Output in this JSON format:
          {{
            "path_title": "A short summary title for the serendipitous path, with an emoji at the beginning",
            "common_indices": [list of integer IDs from both users’ CONVERSATIONS with shared themes],
            "user1_unique_indices": [list of integer IDs from <USER_1> CONVERSATIONS unique to <USER_1>, absent in <USER_2>],
            "user2_unique_indices": [list of integer IDs from <USER_2> CONVERSATIONS unique to <USER_2>, absent in <USER_1>],
            "common_background": "The common ground between <USER_1> and <USER_2> in 2/3 sentences",
            "user_1_unique_branches": "Bullet points of how <USER_1> uniquely branches off from the common ground",
            "user_2_unique_branches": "Bullet points of how <USER_2> uniquely branches off from the common ground",
            "user_1_call_to_action": "Bullet points of what <USER_1> could ask <USER_2> to join the unique branches",
            "user_2_call_to_action": "Bullet points of what <USER_2> could ask <USER_1> to join the unique branches",
            "is_sensitive": "Boolean: true if the path involves sensitive topics (sickness, erotica, etc.), false otherwise."
          }}

          In the text, replace any references to the users with "<USER_1>" and "<USER_2>".

          If you cannot find a serendipitous path, return an empty object: {{}}

          USER 1 CONVERSATIONS:
          {_prepare_user_texts(user1_summaries, excluded_indices)}

          USER 2 CONVERSATIONS:
          {_prepare_user_texts(user2_summaries, excluded_indices)}
        """.strip()
    )


def _join_if_list(value) -> str:
    if isinstance(value, list):
        return "\n".join(value)
    else:
        return value


def parse_serendipity_result(content: str) -> Dict | None:
    """
    Parse the LLM response (in JSON) and return a Python dictionary.
    If the JSON is invalid or empty, return an empty dict.
    """
    try:
        result = repair_json(content, return_objects=True)
        if not isinstance(result, dict):
            return None

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
            return None
        else:
            return {
                "path_title": result.get("path_title", "Serendipitous Connection"),
                "common_indices": common_indices,
                "user1_unique_indices": user1_unique_indices,
                "user2_unique_indices": user2_unique_indices,
                "common_background": result["common_background"],
                "user_1_unique_branches": _join_if_list(
                    result.get("user_1_unique_branches", "")
                ),
                "user_2_unique_branches": _join_if_list(
                    result.get("user_2_unique_branches", "")
                ),
                "user_1_call_to_action": _join_if_list(
                    result.get("user_1_call_to_action", "")
                ),
                "user_2_call_to_action": _join_if_list(
                    result.get("user_2_call_to_action", "")
                ),
                "is_sensitive": result.get("is_sensitive", False),
            }
    except Exception:
        return None


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
        "category": row.get("category", "practical"),
        "human_questions": row.get("human_questions", []),  # Add human questions
    }


def prepare_conversation_summaries(
    df: pl.DataFrame, parsed_conversations: pl.DataFrame = None
) -> List[Dict]:
    """
    Prepare conversation summaries from a DataFrame.

    Args:
        df: A polars DataFrame with conversation data
        parsed_conversations: Optional DataFrame with parsed conversation data including questions

    Returns:
        A list of conversation summary dictionaries
    """
    # Add row indices before sorting
    df_with_idx = df.with_row_count("row_idx")

    # Sort by date/time for a stable ordering
    sorted_df = df_with_idx.sort(["start_date", "start_time"])

    # Extract human questions from parsed_conversations if provided
    human_questions_by_conv = {}
    if parsed_conversations is not None:
        # Create a DataFrame with sorted questions for each conversation_id
        questions_df = parsed_conversations.select(
            ["conversation_id", "date", "time", "question"]
        ).sort(["conversation_id", "date", "time"])

        # Group by conversation_id and collect questions
        for group in questions_df.group_by("conversation_id"):
            conv_id = group[0]
            questions = [row["question"] for row in group[1].iter_rows(named=True)]
            human_questions_by_conv[conv_id] = questions

    summaries = []
    for row in sorted_df.select(
        [
            "row_idx",
            "conversation_id",
            "title",
            "summary",
            "start_date",
            "start_time",
            "category",
        ]
    ).iter_rows(named=True):
        # Add human questions to the row data
        row_data = dict(row)
        row_data["human_questions"] = human_questions_by_conv.get(
            row["conversation_id"], []
        )

        summary = format_conversation_summary(row_data)
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
        "is_sensitive": pl.Boolean,
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
