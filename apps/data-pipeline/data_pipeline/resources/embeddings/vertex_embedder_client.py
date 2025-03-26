import asyncio
import logging
import time

from google import genai
from google.genai.types import EmbedContentConfig

from data_pipeline.resources.embeddings.base_embedder_client import BaseEmbedderClient


class VertexEmbedderClient(BaseEmbedderClient):
    """
    A client for obtaining embeddings from Google's Vertex AI.
    Processes one text at a time as the experimental embeddings API
    only supports batch size of 1.
    """

    _model_name: str
    _project_id: str
    _location: str
    _embedding_dimension: int

    _cost_per_1k_tokens = 0  # TODO

    _last_log_time: float = 0
    _completed_requests: int = 0
    _total_tokens: int = 0

    def __init__(
        self,
        model_name: str = "text-embedding-large-exp-03-07",
        project_id: str = "enclaveid",
        location: str = "us-central1",
        embedding_dimension: int = 3072,
        logger: logging.Logger | None = None,
    ):
        """
        Initialize the Vertex AI Embedder Client.

        Args:
            model_name: The name of the embedding model to use.
            project_id: The Google Cloud project ID.
            location: The Google Cloud region.
            embedding_dimension: The dimension of the embeddings.
            logger: Optional logger instance.
        """
        super().__init__(logger or logging.getLogger(__name__))

        self._model_name = model_name
        self._project_id = project_id
        self._location = location
        self._embedding_dimension = embedding_dimension

        # Initialize the Vertex AI client
        self._client = genai.Client(
            vertexai=True, project=project_id, location=location
        )

        self._status_printer_task = None

    async def _periodic_status_printer(self, total_texts: int) -> None:
        """
        Periodically print status about the embedding progress.

        Args:
            total_texts: The total number of texts being embedded.
        """
        start_time = asyncio.get_event_loop().time()
        while True:
            current_time = asyncio.get_event_loop().time()
            if current_time - self._last_log_time >= 60:  # Only log every 60 seconds
                completed = self._completed_requests
                progress = completed / total_texts
                elapsed_time = current_time - start_time

                # Calculate processing rate (texts per second)
                processing_rate = completed / elapsed_time if elapsed_time > 0 else 0

                # Estimate remaining time based on rate
                remaining_texts = total_texts - completed
                estimated_remaining_time = (
                    remaining_texts / processing_rate if processing_rate > 0 else 0
                )

                self._logger.info(
                    f"Progress: {progress:.1%} | "
                    f"Elapsed: {elapsed_time:.1f}s | "
                    f"Rate: {processing_rate:.1f} texts/s | "
                    f"Estimated remaining: {estimated_remaining_time:.1f}s"
                )
                self._last_log_time = current_time
            await asyncio.sleep(60)

    async def _get_single_embedding(self, text: str) -> list[float] | None:
        """
        Generate embedding for a single text using Google Generative AI.

        Args:
            text: The text to embed.

        Returns:
            A list of floats representing the embedding, or None if failed.
        """
        try:
            # Use the genai library to get embeddings for a single text
            response = self._client.models.embed_content(
                model=self._model_name,
                contents=[text],  # API requires a list even for single text
                config=EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=self._embedding_dimension,
                ),
            )

            # Approximate token count - this is a rough estimate
            estimated_tokens = len(text.split()) * 1.3
            self._total_tokens += estimated_tokens

            # Extract the embedding values from the response
            if not response or not response.embeddings or not response.embeddings[0]:
                self._logger.warning("No embedding values returned from Vertex API")
                return None

            embedding_values = response.embeddings[0].values

            if len(embedding_values) != self._embedding_dimension:
                self._logger.warning(
                    f"Embedding dimension mismatch. Expected {self._embedding_dimension}, got {len(embedding_values)}"
                )
                return None

            return embedding_values

        except Exception as e:
            self._logger.error(f"Error generating Google Generative AI embedding: {e}")
            import traceback

            traceback.print_exc()
            return None

    async def get_embeddings(
        self,
        texts: list[str],
        api_batch_size: int = 30,
        gpu_batch_size: int = 1,
    ) -> tuple[float, list[list[float]]]:
        """
        Get embeddings for a list of texts, processing one text at a time.

        Args:
            texts: The list of texts to embed.
            api_batch_size: Not used as we process one text at a time, kept for API compatibility.
            gpu_batch_size: Not used by this embedder but included for compatibility.

        Returns:
            A tuple of (cost, embeddings).
        """
        self._logger.info(
            f"Getting embeddings for {len(texts)} texts using Vertex AI (one at a time)"
        )

        # Reset counters
        self._total_tokens = 0
        self._completed_requests = 0
        self._last_log_time = 0

        # Start status printer
        self._status_printer_task = asyncio.create_task(
            self._periodic_status_printer(len(texts))
        )

        all_embeddings = []

        try:
            # Process multiple texts with concurrent API calls, limited to api_batch_size at a time
            for i in range(0, len(texts), api_batch_size):
                batch = texts[i : i + api_batch_size]
                self._logger.debug(
                    f"Processing batch {i // api_batch_size + 1}/{(len(texts) + api_batch_size - 1) // api_batch_size}"
                )

                # Process each text in the batch concurrently
                batch_results = await asyncio.gather(
                    *[self._get_single_embedding(text) for text in batch]
                )

                # Update completion counter
                self._completed_requests += len(batch)

                # Add results to all_embeddings
                all_embeddings.extend(batch_results)

                # Log progress
                self._logger.debug(
                    f"Completed texts {i + 1}-{min(i + len(batch), len(texts))}/{len(texts)}"
                )

            # Calculate cost based on estimated tokens
            cost = (self._total_tokens / 1000) * self._cost_per_1k_tokens

            self._logger.info(
                f"Completed embedding {len(texts)} texts. Estimated cost: ${cost:.6f}"
            )

            return cost, all_embeddings

        finally:
            if self._status_printer_task:
                self._status_printer_task.cancel()

    async def close(self) -> None:
        """Close any resources used by the embedder."""
        # The genai client doesn't have a close method
        pass


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    async def main():
        logging.basicConfig(level=logging.INFO)
        client = VertexEmbedderClient(logger=logging.getLogger("test"))
        start_time = time.time()
        try:
            sample_texts = [
                "This is a test message for embedding generation." * 1000,
                "Another example text to embed using Vertex AI." * 1000,
                "Let's see how well these embeddings perform." * 1000,
            ]
            cost, embeddings = await client.get_embeddings(sample_texts)
            print(f"Cost: ${cost:.6f}")
            print(f"Generated {len(embeddings)} embeddings")
            print(
                f"Embedding dimension: {len(embeddings[0]) if embeddings[0] else 'None'}"
            )
        finally:
            await client.close()
            end_time = time.time()
            print(f"Time taken: {end_time - start_time:.2f} seconds")

    asyncio.run(main())
