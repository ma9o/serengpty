import datetime
import os
from typing import List, Tuple

import polars as pl
from dagster import AssetExecutionContext, AssetIn, Config, asset, get_dagster_logger
from google import genai
from google.genai.types import EmbedContentConfig
from google.oauth2 import service_account
from json_repair import repair_json

from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources import PostgresResource


class EmbeddedRepresentativesConfig(Config):
    db_insert_batch_size: int = 5
    embedding_model: str = "text-embedding-large-exp-03-07"
    embedding_dimension: int = 3072
    embedding_task_type: str = "SEMANTIC_SIMILARITY"
    skip_existing: bool = True


@asset(
    partitions_def=user_partitions_def,
    ins={
        "representatives_to_embed": AssetIn(key="representatives_to_embed"),
    },
)
def embedded_representatives(
    context: AssetExecutionContext,
    representatives_to_embed: pl.DataFrame,
    postgres: PostgresResource,
    config: EmbeddedRepresentativesConfig,
):
    """
    Generates embeddings for representative conversations (one at a time via API)
    and upserts them into the 'conversations' table in batches.
    """
    logger = get_dagster_logger()

    if representatives_to_embed.is_empty():
        logger.info("No representatives to embed.")
        return

    # --- 1. Filter out already embedded conversations ---
    if config.skip_existing:
        conversation_ids_to_check = representatives_to_embed[
            "conversation_id"
        ].to_list()
        try:
            # Use parameterized query for safety with %(key_name)s syntax
            query = """
              SELECT id
              FROM conversations
              WHERE embedding IS NOT NULL
              AND id = ANY(%(conversation_ids_to_check)s::uuid[])
              """
            # Keep params as a dictionary
            already_embedded_result = postgres.execute_query(
                query,
                params={"conversation_ids_to_check": conversation_ids_to_check},
            )
            already_embedded_ids = {row["id"] for row in already_embedded_result}
            logger.info(
                f"Found {len(already_embedded_ids)} already embedded conversations."
            )

            # Filter the DataFrame
            # Convert UUIDs/objects in the set to strings for comparison with the string column
            already_embedded_ids_str = list(map(str, already_embedded_ids))
            df_to_process = representatives_to_embed.filter(
                ~pl.col("conversation_id").is_in(already_embedded_ids_str)
            )
            logger.info(f"Need to embed {len(df_to_process)} new representatives.")

            if df_to_process.is_empty():
                logger.info("All representatives are already embedded.")
                return

        except Exception as e:
            logger.error(f"Error checking existing embeddings: {e}")
            # Decide how to handle - maybe proceed with all? For now, re-raise.
            raise

    # --- 2. Initialize Embedding Client ---
    # Make sure authentication (e.g., gcloud ADC) is set up correctly
    try:
        # Parse the service account JSON string into a dictionary
        sa_info = repair_json(
            os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"], return_objects=True
        )
        # Create credentials object from the dictionary, specifying the required scope
        credentials = service_account.Credentials.from_service_account_info(
            sa_info, scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )

        embedding_client = genai.Client(
            vertexai=True,
            project="enclaveid",
            location="us-central1",
            credentials=credentials,
        )
        logger.info(
            f"Initialized Google GenAI client for model {config.embedding_model}"
        )
    except Exception as e:
        logger.error(f"Failed to initialize Google GenAI client: {e}")
        raise

    # --- 3. Process in Batches (Embedding 1-by-1, DB Insert in batches) ---
    batch_data_for_db: List[Tuple] = []
    total_processed = 0
    total_failed_embedding = 0

    try:  # Main processing block with DB connection
        with postgres.get_connection() as conn, conn.cursor() as cur:
            for row in df_to_process.iter_rows(named=True):
                conversation_id = row["conversation_id"]
                text_to_embed = row["text_to_embed"]
                user_id = context.partition_key

                if not text_to_embed:
                    logger.warning(
                        f"Skipping conversation {conversation_id}: Empty content."
                    )
                    continue

                # --- Embed one item ---
                try:
                    logger.debug(f"Embedding conversation {conversation_id}...")
                    response = embedding_client.models.embed_content(
                        model=config.embedding_model,
                        contents=[text_to_embed],  # API expects a list
                        config=EmbedContentConfig(
                            task_type=config.embedding_task_type,
                            output_dimensionality=config.embedding_dimension,
                        ),
                    )

                    if (
                        response
                        and response.embeddings
                        and len(response.embeddings) > 0
                    ):
                        embedding = response.embeddings[0].values
                        if not embedding:
                            raise ValueError(
                                f"Error embedding conversation {conversation_id}: No embedding received from API"
                            )
                        logger.debug(
                            f"Successfully embedded conversation {conversation_id}"
                        )
                    else:
                        raise ValueError("No embedding received from API")

                except Exception as e:
                    logger.error(f"Error embedding {conversation_id}: {e}")
                    total_failed_embedding += 1
                    continue  # Skip this conversation

                # --- Add to DB batch ---
                now = datetime.datetime.now()
                batch_data_for_db.append(
                    (
                        conversation_id,
                        embedding,
                        row.get("title"),
                        row.get("summary"),
                        text_to_embed,  # Using the embedding source text as 'content'
                        row.get("start_datetime"),
                        user_id,
                        now,  # created_at (will be ignored on conflict)
                        now,  # updated_at
                    )
                )
                total_processed += 1

                # --- Insert batch if full ---
                if len(batch_data_for_db) >= config.db_insert_batch_size:
                    logger.info(
                        f"Inserting batch of {len(batch_data_for_db)} embeddings into DB..."
                    )
                    # Use ON CONFLICT DO UPDATE (Upsert)
                    upsert_sql = """
                        INSERT INTO conversations (
                            id, embedding, title, summary, content, datetime, user_id, created_at, updated_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            embedding = EXCLUDED.embedding,
                            title = EXCLUDED.title,
                            summary = EXCLUDED.summary,
                            content = EXCLUDED.content,
                            datetime = EXCLUDED.datetime,
                            user_id = EXCLUDED.user_id,
                            updated_at = EXCLUDED.updated_at;
                    """
                    try:
                        cur.executemany(upsert_sql, batch_data_for_db)
                        conn.commit()  # Commit each batch
                        logger.info("Successfully inserted batch.")
                        batch_data_for_db = []  # Clear the batch
                    except Exception as db_err:
                        logger.error(f"Database error inserting batch: {db_err}")
                        conn.rollback()
                        # We'll log the error and potentially lose this batch.
                        batch_data_for_db = []  # Clear the failed batch

            # --- Insert any remaining items ---
            if batch_data_for_db:
                logger.info(
                    f"Inserting final batch of {len(batch_data_for_db)} embeddings into DB..."
                )
                upsert_sql = """
                    INSERT INTO conversations (
                        id, embedding, title, summary, content, datetime, user_id, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        title = EXCLUDED.title,
                        summary = EXCLUDED.summary,
                        content = EXCLUDED.content,
                        datetime = EXCLUDED.datetime,
                        user_id = EXCLUDED.user_id,
                        updated_at = EXCLUDED.updated_at;
                """
                try:
                    cur.executemany(upsert_sql, batch_data_for_db)
                    conn.commit()  # Commit the final batch
                    logger.info("Successfully inserted final batch.")
                except Exception as db_err:
                    logger.error(f"Database error inserting final batch: {db_err}")
                    conn.rollback()  # Rollback the final batch

    except Exception as e:
        logger.error(f"An unexpected error occurred during processing: {e}")
        # Re-raise the exception to fail the asset run
        raise

    logger.info(
        f"Finished embedding representatives. Total processed: {total_processed}, Embedding failures: {total_failed_embedding}"
    )
