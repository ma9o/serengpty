import asyncio
import json

from azure.core.exceptions import ResourceExistsError
from azure.storage.queue.aio import QueueClient
from dagster import (
    ConfigurableResource,
    InitResourceContext,
    get_dagster_logger,  # Import the logger function
)
from pydantic import PrivateAttr  # Keep using PrivateAttr


class AzureQueueResource(ConfigurableResource):
    account_name: str
    account_key: str
    queue_name: str

    # Internal state using PrivateAttr remains correct
    _client: QueueClient | None = PrivateAttr(default=None)
    _initialized: bool = PrivateAttr(default=False)
    _init_lock: asyncio.Lock = PrivateAttr(default_factory=asyncio.Lock)

    async def _ensure_initialized(self):
        """Initializes the client and queue if not already done."""
        logger = get_dagster_logger()  # Get logger dynamically
        async with self._init_lock:
            if self._initialized:
                return

            if self._client is None:
                logger.info(
                    f"Initializing Azure QueueClient for queue: {self.queue_name}"
                )
                # Calculate connection string *here* using config fields
                connection_string = f"DefaultEndpointsProtocol=https;AccountName={self.account_name};AccountKey={self.account_key};EndpointSuffix=core.windows.net"
                self._client = QueueClient.from_connection_string(
                    conn_str=connection_string, queue_name=self.queue_name
                )

            # Ensure queue exists
            try:
                await self._client.create_queue()
                logger.info(f"Queue '{self.queue_name}' ensured.")
            except ResourceExistsError:
                logger.debug(f"Queue '{self.queue_name}' already exists.")
            except Exception as e:
                logger.error(f"Failed to ensure queue '{self.queue_name}': {e}")
                if self._client:
                    try:  # Best effort to close client on init failure
                        await self._client.close()
                    except Exception:
                        pass  # Ignore errors during cleanup-on-error
                    self._client = None
                raise

            self._initialized = True
            logger.info(
                f"Azure QueueClient for '{self.queue_name}' initialized successfully."
            )

    async def send_message(self, message_content: dict):
        """Sends a message to the Azure Queue."""
        logger = get_dagster_logger()  # Get logger dynamically
        await self._ensure_initialized()

        if self._client is None:
            logger.error(
                "Azure Queue client is not available after initialization attempt."
            )
            raise RuntimeError("Azure Queue client failed to initialize properly.")

        message_string = json.dumps(message_content)
        try:
            await self._client.send_message(message_string)
            logger.debug(f"Sent message to queue '{self.queue_name}'")
        except Exception as e:
            logger.error(f"Failed to send message to queue '{self.queue_name}': {e}")
            raise

    async def _close_client(self):
        """Async helper to close the client."""
        logger = get_dagster_logger()  # Get logger dynamically
        async with self._init_lock:
            if self._client:
                logger.info(f"Closing Azure QueueClient for queue: {self.queue_name}")
                try:
                    await self._client.close()
                except Exception as e:
                    logger.error(f"Error closing Azure QueueClient: {e}")
                finally:
                    self._client = None
                    self._initialized = False

    def teardown_after_execution(self, context: InitResourceContext):
        """Closes the Azure Queue client."""
        logger = context.log or get_dagster_logger()
        if self._client is not None or self._initialized:
            try:
                # Attempt to run the async close cleanly
                loop = asyncio.get_event_loop_policy().get_event_loop()
                if loop.is_running():
                    # Schedule closure on the running loop
                    # Note: This might not fully complete if the process exits very quickly
                    asyncio.ensure_future(self._close_client(), loop=loop)
                    logger.debug(
                        "Scheduled AzureQueueResource client closure on running loop."
                    )
                else:
                    # If no loop running, use asyncio.run (may create/close temp loop)
                    logger.debug(
                        "Running AzureQueueResource client closure using asyncio.run()."
                    )
                    asyncio.run(self._close_client())
            except RuntimeError as e:
                logger.warning(
                    f"Error during AzureQueueResource teardown (loop likely closed): {e}"
                )
            except Exception as e:
                logger.error(f"Exception during AzureQueueResource teardown: {e}")
        else:
            logger.debug(
                "AzureQueueResource teardown: No client instance found to close."
            )
