from typing import Any

from dagster import (
    Definitions,
    load_assets_from_modules,
    multi_or_in_process_executor,
)

from data_pipeline.assets import ai_conversations
from data_pipeline.pre_init import pre_init  # noqa: I001
from data_pipeline.sensors.inputs_sensor import inputs_sensor
from data_pipeline.sensors.outputs_sensor import outputs_sensor

from .resources import resources

pre_init()

asset_modules: list[Any] = [ai_conversations]


all_assets = load_assets_from_modules(asset_modules)


defs = Definitions(
    assets=all_assets,
    sensors=[inputs_sensor, outputs_sensor],
    resources=resources,
    executor=(multi_or_in_process_executor),
)
