import numpy as np
import polars as pl
from dagster import AssetExecutionContext, AssetIn, asset
from sklearn.discriminant_analysis import StandardScaler

from data_pipeline.assets.ai_conversations.utils.balance_scores import (
    calculate_balance_scores,
)
from data_pipeline.partitions import user_partitions_def


@asset(
    partitions_def=user_partitions_def,
    ins={"cluster_categorizations": AssetIn(key="cluster_categorizations")},
    io_manager_key="parquet_io_manager",
)
async def cluster_balance_scores(
    context: AssetExecutionContext, cluster_categorizations: pl.DataFrame
) -> pl.DataFrame:
    if cluster_categorizations.is_empty():
        return pl.DataFrame(schema={"balance_score": pl.Float64})

    current_user_id = context.partition_key
    df = (
        cluster_categorizations.group_by("cluster_id")
        .agg(
            user1_embeddings=pl.col("embedding").where(
                pl.col("user_id") == current_user_id
            ),
            user2_embeddings=pl.col("embedding").where(
                pl.col("user_id") != current_user_id
            ),
        )
        .filter(pl.col("user1_embeddings").list.len() > 0)
        .filter(pl.col("user2_embeddings").list.len() > 0)
        .with_columns(
            balance_nested=pl.struct(
                pl.col("user1_embeddings"), pl.col("user2_embeddings")
            ).map_elements(
                lambda x: {
                    k: v
                    for k, v in zip(
                        ["balance_score", "balance_scores_detailed"],
                        calculate_balance_scores(
                            x["user1_embeddings"], x["user2_embeddings"]
                        ),
                    )
                },
            )
        )
        .unnest("balance_nested")
    )

    scaler = StandardScaler()
    standardized_metrics = scaler.fit_transform(
        np.column_stack(
            [
                [x["imbalance"] for x in df["balance_scores_detailed"]],
                [x["magnitude_factor"] for x in df["balance_scores_detailed"]],
                [x["dist"] for x in df["balance_scores_detailed"]],
            ]
        )
    )

    df = df.with_columns(
        balance_score_scaled=pl.Series(
            standardized_metrics, dtype=pl.List(pl.Float64)
        ).list.sum()
    ).drop("user1_embeddings", "user2_embeddings", "balance_score")

    # Join back with original
    return cluster_categorizations.join(
        df,
        on="cluster_id",
        how="left",
    )
