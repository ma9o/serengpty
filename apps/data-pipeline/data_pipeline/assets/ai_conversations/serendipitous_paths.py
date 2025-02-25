import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    asset,
)

from data_pipeline.partitions import user_partitions_def
from data_pipeline.utils.get_working_dir import get_working_dir


def get_materialized_partitions(context: AssetExecutionContext, asset_name: str):
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


def load_user_dataframe(context: AssetExecutionContext, user_id: str) -> pl.DataFrame:
    return pl.read_parquet(get_working_dir(context) / f"{user_id}.snappy")


@asset(
    partitions_def=user_partitions_def,
    ins={"long_range_causality": AssetIn(key="long_range_causality")},
    io_manager_key="parquet_io_manager",
)
def serendipitous_paths(
    context: AssetExecutionContext,
    long_range_causality: pl.DataFrame,
) -> pl.DataFrame:
    """
    Identifies non-obvious connections between conversations.
    
    This asset:
    - Identifies unexpected connections between conversations
    - Reveals insights that might be missed in linear analysis
    - Currently implemented as a placeholder for future development
    - Could provide valuable unexpected patterns in user journeys
    - Will support cross-user insights when fully implemented
    
    Output columns:
    - Same structure as long_range_causality (currently a placeholder)
    
    Args:
        context: The asset execution context
        long_range_causality: DataFrame with comprehensive causality information
        
    Returns:
        DataFrame with serendipitous path information (currently same as input)
    """

    current_user_id = context.partition_key
    other_user_ids = get_materialized_partitions(context, "aspects_embeddings")

    # For now, just return the input DataFrame
    # Actual implementation will be added later
    return long_range_causality
