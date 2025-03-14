import json
from datetime import datetime
from io import StringIO
from typing import Any, Dict, List

import pandas as pd
import polars as pl
from dagster import (
    AssetExecutionContext,
    Config,
    asset,
)

from data_pipeline.constants.environments import (
    API_STORAGE_DIRECTORY,
    DATA_PROVIDERS,
)
from data_pipeline.partitions import user_partitions_def


def _process_openai_conversation(data: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Process conversation data from OpenAI format into a structured DataFrame.

    Args:
        data (List[Dict[str, Any]]): List of conversation data in OpenAI format
    Returns:
        pd.DataFrame: Processed conversation data
    """
    # Initialize lists to store the processed data
    processed_data = []

    # Iterate through each conversation in the data
    for row in data:
        conversation_id = row["id"]
        title = row["title"]
        mapping = row["mapping"]

        # Create a message lookup dictionary
        message_lookup = {}
        for msg_id, msg in mapping.items():
            message_lookup[msg_id] = msg

        # Process all user messages
        for msg_id, message in mapping.items():
            # Check if message is from user and has required fields
            if (
                message.get("message")
                and message["message"].get("author")
                and message["message"]["author"].get("role") == "user"
                and message["message"].get("create_time")
                and message["message"].get("content")
            ):
                # Extract timestamp and convert to datetime
                timestamp = message["message"]["create_time"]
                dt = datetime.fromtimestamp(timestamp)

                # Process question
                question_parts = message["message"]["content"].get("parts", [""])
                question_parts = [
                    str(part) if isinstance(part, dict) else part
                    for part in question_parts
                ]
                question = "\n".join(question_parts)

                # Look for assistant response in children
                answer = ""
                if message.get("children"):
                    # Get all assistant responses from child messages
                    assistant_responses = []

                    for child_id in message["children"]:
                        child = message_lookup.get(child_id)
                        if (
                            child
                            and child.get("message")
                            and child["message"].get("author")
                            and child["message"]["author"].get("role") == "assistant"
                            and child["message"].get("content")
                        ):
                            # Process answer parts
                            answer_parts = child["message"]["content"].get(
                                "parts", [""]
                            )
                            answer_parts = [
                                str(part) if isinstance(part, dict) else part
                                for part in answer_parts
                            ]
                            answer_text = "\n".join(answer_parts)

                            # Get timestamp for sorting
                            child_timestamp = child["message"].get("create_time", 0)
                            assistant_responses.append((answer_text, child_timestamp))

                    # If multiple responses found, use most recent
                    if assistant_responses:
                        assistant_responses.sort(key=lambda x: x[1], reverse=True)
                        answer = assistant_responses[0][0]

                processed_data.append(
                    {
                        "conversation_id": conversation_id,
                        "title": title,
                        "date": dt.date(),
                        "time": dt.time(),
                        "question": question,
                        "answer": answer,
                    }
                )

    # Create DataFrame from processed data
    df_conversations = pd.DataFrame(processed_data)

    if not df_conversations.empty:
        # Sort by date and time
        df_conversations = df_conversations.sort_values(
            ["conversation_id", "date", "time"], ascending=[True, True, True]
        )

    return df_conversations


def _process_anthropic_conversation(data: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Process conversation data from Anthropic format into a structured DataFrame.

    Args:
        data (List[Dict[str, Any]]): List of conversation data in Anthropic format
    Returns:
        pd.DataFrame: Processed conversation data
    """
    # Initialize lists to store the processed data
    processed_data = []

    # Iterate through each conversation in the data
    for conversation in data:
        conversation_id = conversation["uuid"]
        title = conversation["name"]
        chat_messages = conversation["chat_messages"]

        # Process messages in pairs (human -> assistant)
        for i in range(len(chat_messages) - 1):
            current_msg = chat_messages[i]
            next_msg = chat_messages[i + 1]

            # Skip if not human -> assistant sequence
            if current_msg["sender"] != "human" or next_msg["sender"] != "assistant":
                continue

            # Extract timestamp and convert to datetime
            timestamp_str = current_msg["created_at"]
            dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))

            # Extract question and answer
            question = current_msg["text"]
            answer = next_msg["text"]

            processed_data.append(
                {
                    "conversation_id": conversation_id,
                    "title": title,
                    "date": dt.date(),
                    "time": dt.time(),
                    "question": question,
                    "answer": answer,
                }
            )

    # Create DataFrame from processed data
    df_conversations = pd.DataFrame(processed_data)

    if not df_conversations.empty:
        # Sort by date and time
        df_conversations = df_conversations.sort_values(
            ["conversation_id", "date", "time"], ascending=[True, True, True]
        )

    return df_conversations


def _detect_schema_type(data: List[Dict[str, Any]]) -> str:
    """
    Detect the schema type based on the structure of the data.

    Args:
        data (List[Dict[str, Any]]): The JSON data to analyze
    Returns:
        str: Either "openai" or "anthropic"
    """
    if not data:
        raise ValueError("Empty data provided, cannot detect schema type")

    # Check for key indicators of each schema
    first_item = data[0]

    # Check for Anthropic schema indicators
    if "chat_messages" in first_item and "uuid" in first_item:
        return "anthropic"

    # Check for OpenAI schema indicators
    if "mapping" in first_item and "conversation_id" in first_item:
        return "openai"

    raise ValueError("Unable to determine schema type from the provided data")


@asset(
    partitions_def=user_partitions_def,
    io_manager_key="parquet_io_manager",
)
def parsed_conversations(
    context: AssetExecutionContext, config: Config
) -> pl.DataFrame:
    """
    Extracts and structures raw conversation data from JSON files.
    Supports both OpenAI and Anthropic conversation formats.

    This asset:
    - Identifies the schema type (OpenAI or Anthropic)
    - Transforms unstructured JSON into a clean dataframe with standard fields
    - Uses pandas and polars libraries for efficient data handling
    - Serves as the foundation layer for all subsequent processing steps
    - Each row represents a single Q&A exchange from user conversations

    Output columns:
    - conversation_id: Unique identifier for each conversation
    - title: The title of the conversation
    - date: Date when the exchange occurred
    - time: Time when the exchange occurred
    - question: User's query text
    - answer: Assistant's response text
    """
    user_dir = API_STORAGE_DIRECTORY / context.partition_key

    # Try to determine provider from directory
    path_prefix = None
    for provider_name in DATA_PROVIDERS:
        provider_path = user_dir / provider_name
        json_file = provider_path / "latest.json"
        if json_file.exists():
            path_prefix = provider_name
            break

    if not path_prefix:
        raise ValueError(
            f"Could not find conversation data for user {context.partition_key}"
        )

    # Get the JSON file for the current user
    json_file = user_dir / path_prefix / "latest.json"

    # Load the JSON file directly
    with json_file.fs.open(json_file.path) as f:
        data = f.read()
        conversations_data = json.loads(data)

    if not conversations_data:
        raise ValueError("Expected non-empty conversation data but got empty data.")

    # Detect schema type and process accordingly
    schema_type = _detect_schema_type(conversations_data)

    if schema_type == "openai":
        processed_df = _process_openai_conversation(conversations_data)
    elif schema_type == "anthropic":
        processed_df = _process_anthropic_conversation(conversations_data)
    else:
        raise ValueError(f"Unsupported schema type: {schema_type}")

    if processed_df.empty:
        raise ValueError("Processing resulted in an empty DataFrame.")

    # First we read it into a StringIO object with pandas since polars is a bit stricter
    # with the types
    csv_file = StringIO()
    processed_df.to_csv(csv_file, index=False)
    csv_file.seek(0)

    return pl.from_pandas(pd.read_csv(csv_file))
