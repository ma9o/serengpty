import faiss
import numpy as np
import polars as pl
from dagster import AssetExecutionContext, AssetIn, asset
from sklearn.cluster import AgglomerativeClustering

from data_pipeline.partitions import user_partitions_def

# --- Configuration ---
REPRESENTATIVE_COUNT_TARGET = 300


@asset(
    partitions_def=user_partitions_def,
    ins={
        "conversations_embeddings": AssetIn(key="conversations_embeddings"),
    },
    io_manager_key="parquet_io_manager",
)
def representatives_to_embed(
    context: AssetExecutionContext,
    conversations_embeddings: pl.DataFrame,
) -> pl.DataFrame:
    """
    Selects up to 300 representative conversations per user by performing agglomerative clustering
    on the embeddings and choosing the conversation closest to each cluster's centroid using FAISS.
    Outputs a DataFrame with (conversation_id, text_to_embed).
    """
    # Extract embeddings as a numpy array
    embeddings = np.array(conversations_embeddings["embedding"].to_list())
    n_conversations = len(conversations_embeddings)

    # If conversations are ≤ target, return all, ensuring required columns
    if n_conversations <= REPRESENTATIVE_COUNT_TARGET:
        return conversations_embeddings.select(
            ["conversation_id", "datetime_conversations"]
        ).rename({"datetime_conversations": "text_to_embed"})

    # Perform agglomerative clustering
    clustering = AgglomerativeClustering(
        n_clusters=REPRESENTATIVE_COUNT_TARGET, linkage="ward"
    )
    cluster_labels = clustering.fit_predict(embeddings)

    # Add cluster labels to the DataFrame
    conversations_embeddings = conversations_embeddings.with_columns(
        pl.Series("cluster_id", cluster_labels)
    )

    representative_candidates = []

    # Process each cluster
    for cluster_id, cluster_df in conversations_embeddings.group_by("cluster_id"):
        embeddings_list = cluster_df["embedding"].to_list()
        embeddings_array = np.array(embeddings_list)

        if len(embeddings_array) == 1:
            closest_idx_in_cluster = 0
        else:
            # Normalize embeddings to unit norm
            norms = np.linalg.norm(embeddings_array, axis=1, keepdims=True)
            # Avoid division by zero (though rare with embeddings)
            norms = np.where(norms == 0, 1e-10, norms)
            normalized_embeddings = embeddings_array / norms

            # Compute centroid and normalize it
            centroid = np.mean(embeddings_array, axis=0)
            centroid_norm = np.linalg.norm(centroid)
            # Avoid division by zero
            centroid_norm = max(centroid_norm, 1e-10)
            normalized_centroid = centroid / centroid_norm

            # Create FAISS index with inner product (for cosine similarity on normalized vectors)
            dim = embeddings_array.shape[1]
            index = faiss.IndexFlatIP(dim)
            # FAISS requires float32
            index.add(normalized_embeddings.astype("float32"))

            # Search for the nearest neighbor (max inner product = min cosine distance)
            D, I = index.search(normalized_centroid.astype("float32").reshape(1, -1), 1)
            closest_idx_in_cluster = I[0][0]

        # Select representative conversation
        representative_row = cluster_df[closest_idx_in_cluster]
        conversation_id = representative_row["conversation_id"][0]
        representative_candidates.append(conversation_id)

    # Filter and format the output
    return (
        conversations_embeddings.filter(
            pl.col("conversation_id").is_in(representative_candidates)
        )
        .select(["conversation_id", "datetime_conversations"])
        .rename({"datetime_conversations": "text_to_embed"})
    )
