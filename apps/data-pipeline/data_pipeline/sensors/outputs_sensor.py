import ast
import json
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

from data_pipeline.constants.environments import DAGSTER_STORAGE_DIRECTORY
from data_pipeline.resources.postgres_resource import PostgresResource


@sensor(
    minimum_interval_seconds=30,
    default_status=DefaultSensorStatus.RUNNING,
)
def outputs_sensor(
    context: SensorEvaluationContext, postgres: PostgresResource
) -> SensorResult | SkipReason:
    """Notifies the API that a pipeline has finished, one partition at a time."""

    # -- 1. Initialize or load cursor state --------------------------------- #
    if context.cursor:
        # Cursor is stored as a JSON-string of the form:
        # {"successful": [...], "errored": [...]}
        cursor_data = ast.literal_eval(context.cursor)
        successful_partitions = set(cursor_data.get("successful", []))
        errored_partitions = set(cursor_data.get("errored", []))
    else:
        # If no cursor, bootstrap from the database. Those are considered "successful"
        # since they've already been processed.
        successful_partitions = {
            row["userId"]
            for row in postgres.execute_query(
                'SELECT DISTINCT "userId" FROM "UserPath"'
            )
        }
        # No errored partitions yet if this is the first run.
        errored_partitions = set()

    # -- 2. Determine all locally available partitions ---------------------- #
    asset_folder: UPath = DAGSTER_STORAGE_DIRECTORY / "serendipity_optimized"
    if not asset_folder.exists():
        return SkipReason("No asset folder found.")

    # Force the filesystem to re-check the folder for new files
    asset_folder.fs.invalidate_cache()
    all_partitions = {d.stem for d in asset_folder.iterdir() if d.is_file()}

    # Partitions never tried before (neither in successful nor errored)
    new_partitions = all_partitions - successful_partitions - errored_partitions

    # -- 3. Pick exactly one partition to process this run ------------------ #
    # Priority: pick one new partition if available, otherwise one from errored
    next_partition = None
    if new_partitions:
        next_partition = new_partitions.pop()
    elif errored_partitions:
        # We retry errored partitions only if there are no new ones
        next_partition = errored_partitions.pop()

    if not next_partition:
        # Nothing to process
        return SkipReason("No new or errored partitions remain to process.")

    # -- 4. Attempt to notify the API for this one partition --------------- #
    try:
        response = requests.post(
            os.environ["API_PIPELINE_ENDPOINT"],
            json={"userId": next_partition, "secret": os.environ["PIPELINE_SECRET"]},
            timeout=300,
        ).json()

        # Check response for success
        if response.get("success"):
            # The partition was successfully reported
            successful_partitions.add(next_partition)
            # Ensure it is not in errored anymore
            if next_partition in errored_partitions:
                errored_partitions.remove(next_partition)
            context.log.info(f"Successfully reported partition: {next_partition}")
        else:
            # The partition failed; add it to errored
            errored_partitions.add(next_partition)
            context.log.warning(f"API call failed for partition: {next_partition}")
    except Exception as e:
        # Any unhandled exception also pushes it to errored
        errored_partitions.add(next_partition)
        context.log.error(f"Exception for partition {next_partition}: {str(e)}")

    # -- 5. Update cursor --------------------------------------------------- #
    new_cursor_dict = {
        "successful": sorted(list(successful_partitions)),
        "errored": sorted(list(errored_partitions)),
    }

    return SensorResult(
        run_requests=[],  # No pipeline run requests are triggered here
        cursor=json.dumps(new_cursor_dict),
    )
