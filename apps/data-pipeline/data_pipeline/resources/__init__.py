from dagster import EnvVar
from dagster_polars import PolarsParquetIOManager

from data_pipeline.constants.environments import DAGSTER_STORAGE_DIRECTORY
from data_pipeline.resources.azure_queue_resource import AzureQueueResource
from data_pipeline.resources.batch_embedder_resource import BatchEmbedderResource
from data_pipeline.resources.batch_inference.llms.claude import claude_resource
from data_pipeline.resources.batch_inference.llms.deepseek_r1 import (
    create_deepseek_r1_resource,
)
from data_pipeline.resources.batch_inference.llms.deepseek_v3 import (
    create_deepseek_v3_resource,
)
from data_pipeline.resources.batch_inference.llms.gemini_flash import (
    gemini_flash_resource,
)
from data_pipeline.resources.batch_inference.llms.gemini_pro import gemini_pro_resource
from data_pipeline.resources.batch_inference.llms.gpt4o import create_gpt4o_resource
from data_pipeline.resources.batch_inference.llms.gpt4o_mini import (
    create_gpt4o_mini_resource,
)
from data_pipeline.resources.batch_inference.llms.llama8b import create_llama8b_resource
from data_pipeline.resources.batch_inference.llms.llama70b import (
    create_llama70b_resource,
)
from data_pipeline.resources.batch_inference.llms.llama70b_turbo import (
    create_llama70b_turbo_resource,
)
from data_pipeline.resources.batch_inference.llms.o1_mini import create_o1_mini_resource
from data_pipeline.resources.postgres_resource import PostgresResource

resources = {
    "batch_embedder": BatchEmbedderResource(
        api_key=EnvVar("DEEPINFRA_API_KEY"),
        # base_url=EnvVar("RAY_APP_ADDRESS"),
    ),
    "gemini_flash": gemini_flash_resource(),
    "gpt4o": create_gpt4o_resource(),
    "gpt4o_mini": create_gpt4o_mini_resource(),
    "deepseek_r1": create_deepseek_r1_resource(),
    "parquet_io_manager": PolarsParquetIOManager(
        extension=".snappy", base_dir=str(DAGSTER_STORAGE_DIRECTORY)
    ),
    "postgres": PostgresResource(connection_string=EnvVar("DATABASE_URL")),
    "azure_queue": AzureQueueResource(
        account_name=EnvVar("AZURE_STORAGE_ACCOUNT_NAME"),
        account_key=EnvVar("AZURE_STORAGE_ACCOUNT_KEY"),
        queue_name="gemini-embedding-tasks",
    ),
}
