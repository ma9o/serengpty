import ast
import os

import requests
from dagster import (
    DefaultSensorStatus,
    SensorEvaluationContext,
    SensorResult,
    SkipReason,
    sensor,
)
from upath import UPath

from data_pipeline.constants.environments import (
    DAGSTER_STORAGE_DIRECTORY,
)
from data_pipeline.resources.postgres_resource import PostgresResource


@sensor(
    minimum_interval_seconds=30,
    default_status=DefaultSensorStatus.RUNNING,
)
def outputs_sensor(
    context: SensorEvaluationContext, postgres: PostgresResource
) -> SensorResult | SkipReason:
    """Notifies the API that a pipeline has finished."""

    if context.cursor:
        current_state: set = ast.literal_eval(context.cursor)  # type: ignore
    else:
        # Get user_ids with paths from the database (those already processed)
        current_state = {
            row["userId"]
            for row in postgres.execute_query(
                'SELECT DISTINCT "userId" FROM "UserPath"'
            )
        }

    context.log.info("Current state: %s", current_state)

    asset_folder: UPath = DAGSTER_STORAGE_DIRECTORY / "serendipity_optimized"

    if not asset_folder.exists():
        return SkipReason("No asset folder found.")

    asset_folder.fs.invalidate_cache()
    all_partitions = {d.stem for d in asset_folder.iterdir() if d.is_file()}

    partitions_to_add = all_partitions - current_state

    results = list(
        map(
            lambda user_id: requests.post(
                os.environ["API_PIPELINE_ENDPOINT"],
                json={"userId": user_id},
                timeout=60,
            ).json(),
            partitions_to_add,
        )
    )

    context.log.info("Partitions to add: %s", partitions_to_add)
    context.log.info("Results: %s", results)

    errored_partitions = set(
        [
            item
            for item, result in zip(partitions_to_add, results)
            if not result.get("success")
        ]
    )

    new_cursor = all_partitions - errored_partitions

    return SensorResult([], cursor=str(new_cursor))
