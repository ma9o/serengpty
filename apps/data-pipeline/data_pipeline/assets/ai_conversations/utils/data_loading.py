"""Data loading utilities for conversation assets."""
import polars as pl
from dagster import AssetExecutionContext

from data_pipeline.constants.environments import DAGSTER_STORAGE_DIRECTORY


def load_user_dataframe(user_id: str) -> pl.DataFrame:
    """Load a user's dataframe from Parquet."""
    return pl.read_parquet(
        DAGSTER_STORAGE_DIRECTORY / "conversations_embeddings" / f"{user_id}.snappy"
    )


def get_materialized_partitions(context: AssetExecutionContext, asset_name: str):
    """Retrieve only currently active (non-deleted) partitions for a given asset."""
    # Fetch all materialized partitions
    materialized_partitions = context.instance.get_materialized_partitions(
        context.asset_key_for_input(asset_name)
    )
    # Fetch current dynamic partitions
    current_dynamic_partitions = context.instance.get_dynamic_partitions("users")
    # Filter out deleted partitions
    filtered_partitions = [
        partition
        for partition in materialized_partitions
        if partition in current_dynamic_partitions
    ]
    return filtered_partitions