"""
Utilities for clustering conversations based on embeddings.
This module provides different clustering algorithms that can be used
in the conversation clustering pipeline.
"""

import time
from math import ceil
from typing import Callable, Literal, Optional, cast

import hdbscan
import numpy as np
import umap
from sklearn.cluster import AgglomerativeClustering
from sklearn.decomposition import PCA


def agglomerative_clustering(
    embeddings: np.ndarray,
    log: Callable,
    n_clusters: Optional[int] = None,
    distance_threshold: Optional[float] = None,
    linkage: Literal["ward", "complete", "average", "single"] = "ward",
    max_items_per_cluster: Optional[int] = None,
    max_cluster_iterations: int = 5,
) -> np.ndarray:
    """
    Perform agglomerative clustering on embeddings.

    Args:
        embeddings: Pre-normalized embedding array
        n_clusters: Number of clusters to create (required if distance_threshold is None)
        distance_threshold: Distance threshold for clustering (required if n_clusters is None)
        linkage: Linkage criterion for clustering
        max_items_per_cluster: Maximum number of items allowed per cluster
        max_cluster_iterations: Maximum number of iterations to find optimal clustering

    Returns:
        Cluster labels for each embedding
    """
    if n_clusters is None and distance_threshold is None:
        raise ValueError("Either n_clusters or distance_threshold must be provided")

    # Simple clustering when no max_items_per_cluster constraint or using distance_threshold
    if max_items_per_cluster is None or distance_threshold is not None:
        clustering = AgglomerativeClustering(
            n_clusters=n_clusters,
            distance_threshold=distance_threshold,
            compute_full_tree=True,
            linkage=linkage,
        )
        return clustering.fit_predict(embeddings)

    # Start with estimated number of clusters
    n_items = embeddings.shape[0]
    current_n_clusters = max(1, ceil(n_items / max_items_per_cluster))
    previous_largest_cluster_size = float("inf")
    previous_cluster_labels = None

    for iteration in range(max_cluster_iterations):
        log(
            f"Attempt {iteration + 1}: Creating {current_n_clusters} clusters for {n_items} total items"
        )

        # Cluster the embeddings
        clustering = AgglomerativeClustering(
            n_clusters=current_n_clusters,
            compute_full_tree=True,
            linkage=linkage,
        )
        current_labels = clustering.fit_predict(embeddings)

        # Check if any cluster exceeds the maximum size
        cluster_sizes = np.bincount(current_labels)
        largest_cluster_size = np.max(cluster_sizes)

        if largest_cluster_size <= max_items_per_cluster:
            log(
                f"Success: Largest cluster has {largest_cluster_size} items (max: {max_items_per_cluster})"
            )
            return current_labels

        # Check if increasing clusters didn't help reduce the largest cluster size
        if largest_cluster_size >= previous_largest_cluster_size:
            log(
                "No improvement in cluster sizes after increasing clusters. Using previous clustering."
            )
            # Use the previous clustering results if they exist
            if previous_cluster_labels is not None:
                return previous_cluster_labels
            else:
                return current_labels

        # Save current results before trying with more clusters
        previous_cluster_labels = current_labels
        previous_largest_cluster_size = largest_cluster_size

        # Increase number of clusters and try again
        log(
            f"Largest cluster has {largest_cluster_size} items, exceeding max of {max_items_per_cluster}"
        )
        current_n_clusters += 1

        # Safety check - if we somehow need more clusters than items, something is wrong
        if current_n_clusters >= n_items:
            log("Reached maximum possible clusters, breaking")
            return current_labels

    # If we exit the loop normally (by running out of iterations)
    # Use the last clustering attempt
    return current_labels


def hdbscan_clustering(
    embeddings: np.ndarray,
    min_cluster_size: int = 5,
    min_samples: Optional[int] = None,
    cluster_selection_epsilon: float = 0,
) -> np.ndarray:
    """
    Perform HDBSCAN clustering on embeddings with soft assignment to ensure no noise points.

    Args:
        embeddings: Pre-normalized embedding array
        min_cluster_size: Minimum size of clusters
        min_samples: Number of samples in a neighborhood for a point to be considered a core point
        cluster_selection_epsilon: Clustering threshold

    Returns:
        Cluster labels for each embedding with no noise points (-1)
    """

    # Create and fit the clusterer with prediction_data=True for soft clustering
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        cluster_selection_epsilon=cluster_selection_epsilon,
        metric="cosine",
        prediction_data=True,  # Required for soft clustering
    ).fit(embeddings)

    membership_vectors = hdbscan.all_points_membership_vectors(clusterer)

    return membership_vectors.argmax(axis=1)


AGGLOMERATIVE_CLUSTERING_CONFIG = {
    "n_clusters": None,
    "distance_threshold": None,
    "linkage": "ward",
    "max_items_per_cluster": 100,
    "max_cluster_iterations": 5,
}

HDBSCAN_CLUSTERING_CONFIG = {
    "min_cluster_size": 5,
    "min_samples": None,
    "cluster_selection_epsilon": 0,
}


def cluster_embeddings(
    emb1_array: np.ndarray,
    emb2_array: np.ndarray,
    log: Callable,
    dimension_reduction_method: Literal["pca", "umap"] = "pca",
    dimension_reduction_n_components: int = 100,
    clustering_method: Literal["agglomerative", "hdbscan"] = "agglomerative",
) -> np.ndarray:
    """
    Cluster merged embeddings from two users using the specified clustering method.

    Args:
        emb1_array: Pre-normalized embedding array for first user's conversations
        emb2_array: Pre-normalized embedding array for second user's conversations
        method: Clustering method to use
        logger: Optional logging function

    Returns:
        Cluster labels for each embedding.
        For HDBSCAN, soft clustering ensures all points are assigned to clusters (no -1 labels).
    """
    # Merge embeddings (assumed to be already normalized)
    merged_embeddings = np.vstack([emb1_array, emb2_array])

    start_time = time.time()

    if dimension_reduction_method == "pca":
        merged_embeddings = PCA(
            n_components=dimension_reduction_n_components
        ).fit_transform(merged_embeddings)
    elif dimension_reduction_method == "umap":
        merged_embeddings = umap.UMAP(
            n_components=dimension_reduction_n_components
        ).fit_transform(merged_embeddings)

    log(f"Dimension reduction took {(time.time() - start_time):.2f} seconds")

    merged_embeddings = cast(np.ndarray, merged_embeddings)

    start_time = time.time()

    if clustering_method == "agglomerative":
        labels = agglomerative_clustering(
            merged_embeddings,
            **AGGLOMERATIVE_CLUSTERING_CONFIG,
            log=log,
        )
    elif clustering_method == "hdbscan":
        labels = hdbscan_clustering(
            merged_embeddings,
            **HDBSCAN_CLUSTERING_CONFIG,
        )

    log(f"Clustering took {(time.time() - start_time):.2f} seconds")

    return labels
