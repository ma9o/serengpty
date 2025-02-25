from datetime import datetime
from io import StringIO
from zipfile import ZipFile, is_zipfile

import pandas as pd
import polars as pl
from dagster import (
    AssetExecutionContext,
    Config,
    asset,
)

from data_pipeline.constants.environments import API_STORAGE_DIRECTORY, DataProvider
from data_pipeline.partitions import user_partitions_def


def _process_conversation_data(original_df: pd.DataFrame) -> pd.DataFrame:
    """
    Process conversation data into a structured DataFrame with conversation_id,
    date, time, question and answer columns. Handles branched conversations.

    Args:
        original_df (pd.DataFrame): DataFrame containing the mapping column
    Returns:
        pd.DataFrame: Processed conversation data
    """
    # Initialize lists to store the processed data
    processed_data = []

    # Iterate through each row in the original DataFrame
    for _, row in original_df.iterrows():
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
            if (message.get("message") 
                and message["message"].get("author") 
                and message["message"]["author"].get("role") == "user"
                and message["message"].get("create_time")
                and message["message"].get("content")):
                
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
                        if (child 
                            and child.get("message")
                            and child["message"].get("author")
                            and child["message"]["author"].get("role") == "assistant"
                            and child["message"].get("content")):
                            
                            # Process answer parts
                            answer_parts = child["message"]["content"].get("parts", [""])
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

    # Sort by date and time
    df_conversations = df_conversations.sort_values(
        ["conversation_id", "date", "time"], ascending=[True, True, True]
    )

    return df_conversations


@asset(
    partitions_def=user_partitions_def,
    io_manager_key="parquet_io_manager",
)
def parsed_conversations(
    context: AssetExecutionContext, config: Config
) -> pl.DataFrame:
    """
    Extracts and structures raw conversation data from OpenAI zip archives.
    
    This asset:
    - Transforms unstructured JSON into a clean dataframe with standard fields
    - Uses zipfile, pandas and polars libraries for efficient data handling
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
    archive_path = (
        API_STORAGE_DIRECTORY
        / context.partition_key
        / DataProvider.OPENAI["path_prefix"]
        / "latest.zip"
    )

    expected_file = DataProvider.OPENAI["expected_file"]
    with archive_path.open("rb") as f:
        if not is_zipfile(f):
            raise ValueError("Expected a zip archive but got a different file type.")

        with ZipFile(f, "r") as zip_ref, zip_ref.open(expected_file) as zip_f:
            raw_df = pd.read_json(zip_f)

    if raw_df.empty:
        raise ValueError("Expected a non-empty DataFrame but got an empty one.")

    processed_df = _process_conversation_data(raw_df)

    # First we read it into a StringIO object with pandas since polars is a bit stricter
    # with the types
    csv_file = StringIO()
    processed_df.to_csv(csv_file, index=False)
    csv_file.seek(0)

    return pl.from_pandas(pd.read_csv(csv_file))
