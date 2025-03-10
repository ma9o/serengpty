import ast

from dagster import (
    AssetSelection,
    DefaultSensorStatus,
    RunRequest,
    SensorEvaluationContext,
    SensorResult,
    SkipReason,
    sensor,
)

from data_pipeline.constants.environments import (
    API_STORAGE_DIRECTORY,
    DAGSTER_STORAGE_DIRECTORY,
    STORAGE_BUCKET,
)
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.postgres_resource import PostgresResource


@sensor(
    asset_selection=AssetSelection.all(),
    minimum_interval_seconds=30,
    default_status=DefaultSensorStatus.RUNNING,
)
def inputs_sensor(
    context: SensorEvaluationContext, postgres: PostgresResource
) -> SensorResult | SkipReason:
    """Polls the storage bucket for user folders.

    Adds or removes user partitions based on the presence of user folders. Note
    that this will also remove partitions if a user's folder has been deleted."""

    if context.cursor:
        current_state: set = ast.literal_eval(context.cursor)  # type: ignore
    else:
        # Get user_ids that have been processed already
        asset_folder = DAGSTER_STORAGE_DIRECTORY / "serendipity_optimized"
        if asset_folder.exists():
            asset_folder.fs.invalidate_cache()
            current_state = {d.stem for d in asset_folder.iterdir() if d.is_file()}
        else:
            current_state = set()

    context.log.info("Current state: %s", current_state)

    if not API_STORAGE_DIRECTORY.exists():
        return SkipReason("No API storage directory found.")

    API_STORAGE_DIRECTORY.fs.invalidate_cache()
    all_partitions = {d.name for d in API_STORAGE_DIRECTORY.iterdir() if d.is_dir()}

    partitions_to_add = all_partitions - current_state
    partitions_to_delete = current_state - all_partitions

    # Delete materializations for partitions that are no longer present
    if partitions_to_delete:
        glob_pattern = f"**/*({' | '.join(partitions_to_delete)}).snappy"

        for file_path in STORAGE_BUCKET.rglob(glob_pattern):
            if file_path.is_file():
                file_path.unlink()
                context.log.info(f"Deleted: {file_path.relative_to(STORAGE_BUCKET)}")

    if len(partitions_to_add) + len(partitions_to_delete) > 0:
        return SensorResult(
            run_requests=[
                RunRequest(
                    run_key=f"first_upload_{k}",
                    partition_key=k,
                )
                for k in partitions_to_add
            ],
            cursor=str(all_partitions),
            dynamic_partitions_requests=[
                user_partitions_def.build_add_request(sorted(partitions_to_add)),
                user_partitions_def.build_delete_request(sorted(partitions_to_delete)),
            ],
        )
    else:
        return SkipReason("No changes detected at the end.")
