import polars as pl
from dagster import AssetExecutionContext, AssetIn, asset

from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.constants.environments import get_environment
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.batch_embedder_resource import BatchEmbedderResource


class ConversationEmbeddingsConfig(RowLimitConfig):
    row_limit: int | None = None if get_environment() == "LOCAL" else None


@asset(
    partitions_def=user_partitions_def,
    ins={
        "conversation_summaries": AssetIn(
            key=["conversation_summaries"],
        ),
    },
    io_manager_key="parquet_io_manager",
    pool="bge_en_icl",
)
async def conversations_embeddings(
    context: AssetExecutionContext,
    config: ConversationEmbeddingsConfig,
    batch_embedder: BatchEmbedderResource,
    conversation_summaries: pl.DataFrame,
) -> pl.DataFrame:
    """
    Creates vector embeddings for conversation summaries to enable similarity search.

    This asset:
    - Vectorizes conversation summaries using DeepInfraEmbedderClient
    - Processes in efficient batches to handle large datasets
    - Adds semantic meaning through vector representations
    - Enables similarity-based operations in later stages
    - Critical for transitioning from text to machine-understandable format

    Output columns:
    - All columns from conversation_summaries
    - embedding: Vector representation of conversation summary

    Args:
        context: The asset execution context
        config: Configuration for row limiting
        batch_embedder: Resource for creating embeddings
        conversation_summaries: DataFrame containing conversation summaries

    Returns:
        DataFrame with added embedding column for conversation summaries
    """
    embedder = batch_embedder
    df = conversation_summaries.slice(0, config.row_limit)

    # Get summaries to embed
    summaries = df.select(pl.col("summary")).to_series().to_list()

    # Get embeddings for summaries
    cost, embeddings = await embedder.get_embeddings(summaries, api_batch_size=100)
    context.log.info(f"Embedding cost: ${cost:.2f}")

    # Add embedding column to the result DataFrame
    result = df.with_columns(
        [
            pl.Series(
                dtype=pl.List(pl.Float64),
                name="embedding",
                values=embeddings,
                strict=False,
            ),
        ]
    )

    # Check for invalid embeddings
    invalid_embeddings = result.filter(pl.col("embedding").is_null())

    if invalid_embeddings.height > 0:
        context.log.warning(f"Found {invalid_embeddings.height} invalid embeddings.")

    # Filter out rows with invalid embeddings
    result = result.filter(pl.col("embedding").is_not_null())

    return result
