import polars as pl

from data_pipeline.constants.environments import DAGSTER_STORAGE_DIRECTORY


def load_user_dataframe(user_id: str, asset_name: str) -> pl.DataFrame:
    """Load a user's dataframe from Parquet."""
    return pl.read_parquet(DAGSTER_STORAGE_DIRECTORY / asset_name / f"{user_id}.snappy")
