import asyncio
import json
import logging

from azure.core.exceptions import ResourceExistsError
from azure.storage.queue.aio import QueueClient
from dagster import ConfigurableResource, InitResourceContext


class AzureQueueResource(ConfigurableResource):
    account_name: str
    account_key: str
    queue_name: str

    _client: QueueClient | None = None

    async def _init_client(self):
        # Use context manager for proper connection handling if needed,
        # but QueueClient itself might manage connections internally.
        connection_string = f"DefaultEndpointsProtocol=https;AccountName={self.account_name};AccountKey={self.account_key};EndpointSuffix=core.windows.net"
        self._client = QueueClient.from_connection_string(
            conn_str=connection_string, queue_name=self.queue_name
        )
        # Ensure queue exists (optional, good for first run)
        try:
            await self._client.create_queue()
            self.logger.info(f"Queue '{self.queue_name}' ensured.")
        except ResourceExistsError:
            self.logger.debug(f"Queue '{self.queue_name}' already exists.")
        except Exception as e:
            self.logger.error(f"Failed to ensure queue '{self.queue_name}': {e}")
            raise

    def setup_for_execution(self, context: InitResourceContext):
        self.logger = context.log or logging.getLogger(__name__)
        # Run async initialization in a synchronous context
        asyncio.run(self._init_client())

    async def send_message(self, message_content: dict):
        if not self._client:
            await (
                self._init_client()
            )  # Re-init if needed (though setup_for_execution should handle it)

        if self._client is None:
            raise ValueError("Client not initialized")

        message_string = json.dumps(message_content)
        await self._client.send_message(message_string)

    async def close(self):
        if self._client:
            await self._client.close()
            self._client = None

    def teardown_after_execution(self, context: InitResourceContext):
        asyncio.run(self.close())
