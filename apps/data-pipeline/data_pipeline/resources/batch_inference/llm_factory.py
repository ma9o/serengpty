from dagster import get_dagster_logger

from data_pipeline.resources.batch_inference.base_llm_resource import (
    BaseLlmResource,
    LlmConfig,
)
from data_pipeline.resources.batch_inference.remote_llm_resource import (
    RemoteLlmResource,
)


def create_llm_resource(config: LlmConfig) -> BaseLlmResource:
    logger = get_dagster_logger()

    if config.remote_llm_config is None:
        logger.warning(
            f"Remote LLM config not found for model: {config.colloquial_model_name}"
        )
    else:
        return RemoteLlmResource(
            llm_config=config.remote_llm_config, is_multimodal=config.is_multimodal
        )
