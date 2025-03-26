import asyncio

import polars as pl
from dagster import AssetExecutionContext, AssetIn, asset

from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.azure_queue_resource import AzureQueueResource


@asset(
    partitions_def=user_partitions_def,
    ins={
        "representatives_to_embed": AssetIn(key="representatives_to_embed"),
    },
    io_manager_key="parquet_io_manager",
)
async def queue_gemini_embeddings(
    context: AssetExecutionContext,
    representatives_to_embed: pl.DataFrame,
    azure_queue: AzureQueueResource,
) -> None:
    """Sends representative conversation details to Azure Queue for embedding."""
    logger = context.log
    num_queued = 0

    if representatives_to_embed.is_empty():
        logger.info("No representative conversations to queue.")
        return

    tasks = []
    for row in representatives_to_embed.iter_rows(named=True):
        message = {
            "conversation_id": row["conversation_id"],
            "text": row["text_to_embed"],
        }
        tasks.append(azure_queue.send_message(message))
        num_queued += 1

    await asyncio.gather(*tasks)

    logger.info(f"Successfully queued {num_queued} embedding tasks.")
