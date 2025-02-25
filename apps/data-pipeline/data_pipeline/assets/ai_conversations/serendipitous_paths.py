from typing import Dict, List, Tuple

import faiss
import networkx as nx
import numpy as np
import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    asset,
)

from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.constants.environments import get_environment
from data_pipeline.partitions import user_partitions_def
from data_pipeline.utils.get_working_dir import get_working_dir
from data_pipeline.utils.graph.save_graph import save_graph


def get_materialized_partitions(context: AssetExecutionContext, asset_name: str):
    # Fetch all materialized partitions
    materialized_partitions = context.instance.get_materialized_partitions(
        context.asset_key_for_input(asset_name)
    )

    # Fetch current dynamic partitions
    current_dynamic_partitions = context.instance.get_dynamic_partitions("users")

    # Filter out deleted partitions
    filtered_partitions = [
        partition
        for partition in materialized_partitions
        if partition in current_dynamic_partitions
    ]

    return filtered_partitions


def load_user_dataframe(context: AssetExecutionContext, user_id: str) -> pl.LazyFrame:
    """Load a user's dataframe as a LazyFrame to reduce memory consumption."""
    return pl.scan_parquet(get_working_dir(context) / f"{user_id}.snappy")


def find_longest_common_paths(user_graphs: Dict[str, nx.DiGraph]) -> List[List[str]]:
    """
    Find the longest common directed paths across multiple user graphs.

    Args:
        user_graphs: Dictionary mapping user_ids to their respective DiGraphs

    Returns:
        List of paths (each path is a list of node IDs)
    """
    if not user_graphs:
        return []

    # Extract all paths from all graphs
    all_paths: Dict[str, List[List[str]]] = {}

    for user_id, graph in user_graphs.items():
        # Find all simple paths in the graph - using memory-efficient approach
        paths = []

        # Get top nodes by out-degree (more likely to be starting points of paths)
        source_nodes = sorted(
            graph.nodes(), key=lambda n: graph.out_degree(n), reverse=True
        )[:50]  # Limit to top 50 source nodes

        # Get top nodes by in-degree (more likely to be end points of paths)
        target_nodes = sorted(
            graph.nodes(), key=lambda n: graph.in_degree(n), reverse=True
        )[:50]  # Limit to top 50 target nodes

        # Only consider paths between high-degree nodes
        for source in source_nodes:
            for target in target_nodes:
                if source != target:
                    try:
                        # Get simple paths with cutoff to limit memory usage
                        simple_paths = list(
                            nx.all_simple_paths(
                                graph,
                                source,
                                target,
                            )
                        )
                        # Only keep paths with length >= 2
                        paths.extend([p for p in simple_paths if len(p) >= 2])
                    except nx.NetworkXError:
                        # Handle any network errors gracefully
                        continue

        # Convert node IDs to strings for consistency
        string_paths = [[str(node) for node in path] for path in paths]
        all_paths[user_id] = string_paths

    # Find common path patterns across users
    # Start with the longest paths and work down
    max_path_length = max(
        [len(path) for paths in all_paths.values() for path in paths], default=0
    )

    common_paths = []

    # Check paths of decreasing length
    for path_len in range(max_path_length, 1, -1):
        # Extract paths of current length for each user
        paths_by_length = {
            user_id: [path for path in paths if len(path) == path_len]
            for user_id, paths in all_paths.items()
        }

        # Find paths that appear in multiple users' graphs
        path_counts = {}
        for user_id, paths in paths_by_length.items():
            for path in paths:
                path_tuple = tuple(path)  # Make hashable
                if path_tuple not in path_counts:
                    path_counts[path_tuple] = set()
                path_counts[path_tuple].add(user_id)

        # Keep paths that appear in at least 2 users' graphs
        for path_tuple, user_set in path_counts.items():
            if len(user_set) >= 2:
                common_paths.append(list(path_tuple))

        # If we found enough common paths, stop
        if len(common_paths) >= 10:
            break

    # Sort by path length (longest first)
    return sorted(common_paths, key=len, reverse=True)


def greedy_bipartite_matching(
    embeddings1: List[np.ndarray],
    embeddings2: List[np.ndarray],
    similarity_threshold: float = 0.5,
) -> List[Tuple[int, int, float]]:
    """
    Perform greedy bipartite matching between two sets of embeddings using FAISS.

    Args:
        embeddings1: List of embeddings from the first set
        embeddings2: List of embeddings from the second set
        similarity_threshold: Minimum similarity threshold for matching

    Returns:
        List of tuples (idx1, idx2, similarity_score)
    """
    if not embeddings1 or not embeddings2:
        return []

    # Convert lists to numpy arrays
    emb1_array = np.array(embeddings1, dtype=np.float32)
    emb2_array = np.array(embeddings2, dtype=np.float32)

    # Get embedding dimension
    dim = emb1_array.shape[1]

    # Normalize embeddings for cosine similarity
    faiss.normalize_L2(emb1_array)
    faiss.normalize_L2(emb2_array)

    # Build FAISS index
    index = faiss.IndexFlatIP(
        dim
    )  # Inner product index for cosine similarity on normalized vectors
    index.add(emb2_array)

    # For each embedding in embeddings1, find top K nearest in embeddings2
    # Use k=embeddings2.shape[0] to get all possible matches
    k = min(100, emb2_array.shape[0])  # Limit k for efficiency with large sets
    distances, indices = index.search(emb1_array, k)

    # Perform greedy matching
    matches = []
    used_indices2 = set()

    for idx1, (similarities, neighbor_indices) in enumerate(zip(distances, indices)):
        # Find the best available match
        for rank, (similarity, idx2) in enumerate(zip(similarities, neighbor_indices)):
            # Inner product is in [-1, 1] for normalized vectors (cosine similarity)
            if idx2 not in used_indices2 and similarity >= similarity_threshold:
                matches.append((idx1, int(idx2), float(similarity)))
                used_indices2.add(idx2)
                break

    # Sort by similarity score (highest first)
    return sorted(matches, key=lambda x: x[2], reverse=True)


class SerendipitousPathsConfig(RowLimitConfig):
    # Minimum similarity threshold for embedding matching
    similarity_threshold: float = 0.5
    # Maximum number of paths to return
    max_paths: int = 10
    # Maximum number of users to process at once
    max_users_per_batch: int = 5
    # Save graph visualization
    save_graphml: bool = get_environment() == "LOCAL"


@asset(
    partitions_def=user_partitions_def,
    ins={"long_range_causality": AssetIn(key="long_range_causality")},
    io_manager_key="parquet_io_manager",
)
def serendipitous_paths(
    context: AssetExecutionContext,
    config: SerendipitousPathsConfig,
    long_range_causality: pl.DataFrame,
) -> pl.DataFrame:
    """
    Discovers common thought patterns across different users.

    This asset:
    - Dynamically loads data from users' long-range causality assets
    - Uses LazyFrames to reduce memory consumption
    - Performs greedy bipartite matching between users' embeddings
    - Identifies longest common paths in causality graphs
    - Generates cross-user serendipitous connections
    - Creates shared knowledge representations

    Processing steps:
    1. Process users in batches to reduce memory consumption
    2. Perform greedy bipartite matching by prioritizing local similarity
       for each embedding for each user
    3. Find the longest common paths across user graphs
    4. Add descriptions and metadata to the common paths
    5. Generate visualization of cross-user paths

    Output columns:
    - path_id: Unique identifier for the serendipitous path
    - user_id: Current user's ID
    - path_nodes: List of node IDs in the common path
    - path_description: Natural language description of the common path
    - path_length: Number of nodes in the path
    - shared_with_users: List of user IDs who share this path
    - similarity_score: Average similarity score of the path across users
    - created_at: Timestamp when the path was discovered

    Args:
        context: The asset execution context
        config: Configuration for serendipitous path detection
        long_range_causality: DataFrame with long-range causality information

    Returns:
        DataFrame with serendipitous path information at the path level
    """
    current_user_id = context.partition_key
    other_user_ids = get_materialized_partitions(context, "long_range_causality")
    logger = context.log

    # Filter out the current user from other_user_ids if present
    other_user_ids = [uid for uid in other_user_ids if uid != current_user_id]

    if not other_user_ids:
        logger.info("No other users found for serendipitous path detection")
        # Return an empty path-level DataFrame with proper schema
        return pl.DataFrame(
            schema={
                "path_id": pl.String,
                "user_id": pl.String,
                "path_nodes": pl.List(pl.String),
                "path_description": pl.String,
                "path_length": pl.Int32,
                "shared_with_users": pl.List(pl.String),
                "similarity_score": pl.Float32,
                "created_at": pl.Datetime,
            }
        )

    # Process current user data first
    current_user_embeddings = long_range_causality["embedding"].to_list()

    # Create graph for current user
    current_user_graph = nx.DiGraph()

    # Add nodes for current user
    for row in long_range_causality.select(["row_idx", "summary"]).iter_rows(
        named=True
    ):
        current_user_graph.add_node(row["row_idx"], summary=row["summary"])

    # Add edges for current user
    for row in long_range_causality.iter_rows(named=True):
        row_idx = row["row_idx"]
        caused_by = row.get("caused_by", [])

        if caused_by:
            for cause_idx in caused_by:
                current_user_graph.add_edge(cause_idx, row_idx)

    logger.info(
        f"Created graph for current user with {current_user_graph.number_of_nodes()} nodes"
    )

    # Perform cross-user embedding matching and graph building one user at a time
    cross_user_matches = {}
    user_graphs = {current_user_id: current_user_graph}

    # Process other users in batches to limit memory usage
    # Divide users into batches
    user_batches = [
        other_user_ids[i : i + config.max_users_per_batch]
        for i in range(0, len(other_user_ids), config.max_users_per_batch)
    ]

    for batch_idx, user_batch in enumerate(user_batches):
        logger.info(
            f"Processing user batch {batch_idx + 1}/{len(user_batches)} with {len(user_batch)} users"
        )

        # Process each user in the batch
        for user_id in user_batch:
            try:
                # Load user data as LazyFrame
                user_lazy_df = load_user_dataframe(context, user_id)

                # Only materialize required columns to limit memory usage
                user_df_embeddings = (
                    user_lazy_df.select(["embedding"])
                    .filter(pl.col("embedding").is_not_null())
                    .collect()
                )

                if user_df_embeddings.height == 0:
                    logger.info(
                        f"No valid embeddings found for user {user_id}, skipping"
                    )
                    continue

                # Get embeddings
                other_embeddings = user_df_embeddings["embedding"].to_list()

                # Perform greedy bipartite matching
                matches = greedy_bipartite_matching(
                    current_user_embeddings,
                    other_embeddings,
                    similarity_threshold=config.similarity_threshold,
                )

                if matches:
                    cross_user_matches[user_id] = matches
                    logger.info(f"Found {len(matches)} matches with user {user_id}")

                # Only materialize graph-related columns
                user_df_graph = user_lazy_df.select(
                    ["row_idx", "summary", "caused_by"]
                ).collect()

                # Create directed graph for this user
                G = nx.DiGraph()

                # Add nodes
                for row in user_df_graph.select(["row_idx", "summary"]).iter_rows(
                    named=True
                ):
                    G.add_node(row["row_idx"], summary=row["summary"])

                # Add edges based on caused_by
                for row in user_df_graph.iter_rows(named=True):
                    row_idx = row["row_idx"]
                    caused_by = row.get("caused_by", [])

                    if caused_by:
                        for cause_idx in caused_by:
                            G.add_edge(cause_idx, row_idx)

                user_graphs[user_id] = G
                logger.info(
                    f"Created graph for user {user_id} with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges"
                )

            except Exception as e:
                logger.error(f"Error processing data for user {user_id}: {e}")
                continue

    # Find longest common paths across user graphs
    common_paths = find_longest_common_paths(user_graphs)
    logger.info(f"Found {len(common_paths)} common paths across users")

    # Create a path-level DataFrame structure
    path_data = []

    import datetime
    import uuid

    # Process common paths
    for i, path in enumerate(common_paths):
        # Calculate which users share this path
        users_with_path = []
        for user_id, graph in user_graphs.items():
            # Check if all edges in this path exist in the user's graph
            path_exists = True
            for j in range(len(path) - 1):
                if not graph.has_edge(path[j], path[j + 1]):
                    path_exists = False
                    break
            if path_exists:
                users_with_path.append(user_id)

        # Build description for the path
        path_nodes = []
        for node_id in path:
            # Try to find this node in current user's graph first
            if node_id in current_user_graph:
                summary = current_user_graph.nodes[node_id].get("summary", "")
                path_nodes.append(summary)
            else:
                # If not found, check other users' graphs
                for user_id in users_with_path:
                    if user_id != current_user_id and node_id in user_graphs[user_id]:
                        summary = user_graphs[user_id].nodes[node_id].get("summary", "")
                        path_nodes.append(summary)
                        break

        path_description = " → ".join(path_nodes)

        # Calculate average similarity score for this path
        similarity_scores = []
        for user_id in users_with_path:
            if user_id == current_user_id:
                continue
            if user_id in cross_user_matches:
                for match in cross_user_matches[user_id]:
                    if str(match[0]) in path or str(match[1]) in path:
                        similarity_scores.append(match[2])

        avg_similarity = (
            sum(similarity_scores) / len(similarity_scores)
            if similarity_scores
            else 0.0
        )

        # Add this path to the results
        path_data.append(
            {
                "path_id": str(uuid.uuid4()),
                "user_id": current_user_id,
                "path_nodes": [str(node) for node in path],
                "path_description": path_description,
                "path_length": len(path),
                "shared_with_users": [
                    uid for uid in users_with_path if uid != current_user_id
                ],
                "similarity_score": avg_similarity,
                "created_at": datetime.datetime.now(),
            }
        )

    # Create and save visualization graph if enabled
    if config.save_graphml and common_paths:
        # Create a graph for visualization
        G = nx.DiGraph()

        # Add nodes and edges from common paths
        node_summaries = {}

        # Collect all node summaries
        for user_id, graph in user_graphs.items():
            for node, attrs in graph.nodes(data=True):
                if "summary" in attrs:
                    node_key = f"{user_id}_{node}"
                    node_summaries[node_key] = attrs["summary"]

        # Add nodes and edges from common paths
        for path in common_paths:
            for i in range(len(path) - 1):
                source = path[i]
                target = path[i + 1]

                # Add nodes with summaries if available
                if f"{current_user_id}_{source}" in node_summaries:
                    G.add_node(
                        source, summary=node_summaries[f"{current_user_id}_{source}"]
                    )
                else:
                    G.add_node(source)

                if f"{current_user_id}_{target}" in node_summaries:
                    G.add_node(
                        target, summary=node_summaries[f"{current_user_id}_{target}"]
                    )
                else:
                    G.add_node(target)

                # Add edge
                G.add_edge(source, target, type="serendipitous")

        # Save the graph
        save_graph(G, context)

    # Return the path-level DataFrame
    return pl.DataFrame(path_data)
