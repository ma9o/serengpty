import faiss
import numpy as np
import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    asset,
)

from data_pipeline.assets.ai_conversations.utils.data_loading import (
    get_materialized_partitions,
    load_user_dataframe,
)
from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.partitions import user_partitions_def


class ConversationPairCandidatesConfig(RowLimitConfig):
    max_pairs_per_user: int = 700
    # Number of top similar users to consider
    top_k_users: int = 10
    # Threshold above which we treat embeddings as "positively similar"
    high_cutoff: float = 0.8
    # Negative threshold below which we treat embeddings as "negatively similar"
    low_cutoff: float = 0.2


def calculate_user_average_embedding(embeddings: list[np.ndarray]) -> np.ndarray:
    """Calculate the average embedding vector for a user."""
    if isinstance(embeddings, list) and len(embeddings) == 0:
        return np.array([])
    # Handle case where embeddings might be a numpy array already
    if isinstance(embeddings, np.ndarray) and embeddings.size == 0:
        return np.array([])

    stacked = np.vstack(embeddings)
    return np.mean(stacked, axis=0)


def find_top_k_users(
    current_user_embedding: np.ndarray,
    user_embeddings: dict[str, np.ndarray],
    top_k: int,
) -> list[tuple[str, float]]:
    """
    Find the top K most similar users based on embedding similarity (dot product / cosine).

    Returns:
        List of (user_id, similarity_score) sorted by similarity desc.
    """
    if not user_embeddings:
        return []

    user_ids = list(user_embeddings.keys())
    embedding_matrix = np.array(
        [user_embeddings[uid] for uid in user_ids], dtype=np.float32
    )
    dim = embedding_matrix.shape[1]

    # Build FAISS index for fast similarity search
    index = faiss.IndexFlatIP(dim)  # inner product
    index.add(embedding_matrix)

    k = min(top_k, len(user_ids))
    distances, indices = index.search(current_user_embedding.reshape(1, -1), k)

    results = []
    for sim, idx in zip(distances[0], indices[0]):
        results.append((user_ids[idx], float(sim)))

    # Sort descending
    results.sort(key=lambda x: x[1], reverse=True)
    return results


def compute_pairwise_similarities(
    emb1_array: np.ndarray,
    emb2_array: np.ndarray,
) -> np.ndarray:
    """
    Compute the full pairwise similarity matrix between emb1_array and emb2_array.
    Both should be float32 arrays of shape [N, dim], [M, dim].
    Returns an N x M array of dot products (similarities).
    """
    # Build FAISS index for emb2
    dim = emb2_array.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(emb2_array)

    # Search each vector in emb1_array for all results in emb2_array
    distances, indices = index.search(emb1_array, emb2_array.shape[0])
    # distances[i] will be an array of length M, but sorted by descending similarity.
    # We actually need *all* pairwise similarities in their original indices.
    #
    # Easiest approach: manually compute the full NxM dot product. For big N & M
    # you might need a more memory-friendly approach, but we'll do the simple method:
    return np.matmul(emb1_array, emb2_array.T)


def greedy_bipartite_match(
    candidates: list[tuple[int, int, float]],
    n1: int,
    n2: int,
) -> list[tuple[int, int, float]]:
    """
    Greedy bipartite matching from a list of (i, j, similarity).
    - Sorts `candidates` by descending similarity.
    - Iterates from best to worst, matching i with j if both unmatched.
    - n1, n2 = number of items in the two sets (user1 conversations, user2 conversations).

    Returns:
        A list of matched pairs (i, j, similarity).
    """
    matched_user1 = set()
    matched_user2 = set()
    matches = []

    # Sort candidates by descending similarity
    candidates_sorted = sorted(candidates, key=lambda x: x[2], reverse=True)

    for i, j, sim in candidates_sorted:
        if i not in matched_user1 and j not in matched_user2:
            # Match them
            matched_user1.add(i)
            matched_user2.add(j)
            matches.append((i, j, sim))

    return matches


@asset(
    partitions_def=user_partitions_def,
    ins={"conversations_embeddings": AssetIn(key="conversations_embeddings")},
    io_manager_key="parquet_io_manager",
)
def conversation_pair_candidates(
    context: AssetExecutionContext,
    config: ConversationPairCandidatesConfig,
    conversations_embeddings: pl.DataFrame,
) -> pl.DataFrame:
    """
    Create candidate conversation pairs for serendipity detection, using a two-pass approach:
    1) Positive pass: match pairs with similarity >= high_cutoff (greedy bipartite).
    2) Negative pass: for leftovers, match pairs with similarity <= low_cutoff (again greedy bipartite),
       implemented by negating the second user's embeddings and re-checking similarity >= -low_cutoff.
    """
    current_user_id = context.partition_key
    logger = context.log

    other_user_ids = get_materialized_partitions(context, "conversations_embeddings")
    other_user_ids = [uid for uid in other_user_ids if uid != current_user_id]

    if not other_user_ids:
        logger.info("No other users found for candidate pair detection.")
        return pl.DataFrame(
            schema={
                "user2_id": pl.Utf8,
                "conv1": pl.Struct(
                    {
                        "row_idx": pl.UInt32,
                        "conversation_id": pl.Utf8,
                        "title": pl.Utf8,
                        "summary": pl.Utf8,
                        "start_date": pl.Utf8,
                        "start_time": pl.Utf8,
                    }
                ),
                "conv2": pl.Struct(
                    {
                        "row_idx": pl.UInt32,
                        "conversation_id": pl.Utf8,
                        "title": pl.Utf8,
                        "summary": pl.Utf8,
                        "start_date": pl.Utf8,
                        "start_time": pl.Utf8,
                    }
                ),
                "cosine_similarity": pl.Float32,
            }
        )

    logger.info(
        f"Processing {len(other_user_ids)} users for conversation pairs with user {current_user_id}"
    )

    # Current user data
    current_user_df = conversations_embeddings.with_row_count("row_idx")
    emb1_list = current_user_df["embedding"].to_list()
    if not emb1_list:
        logger.info("No embeddings for current user, nothing to match.")
        # Return empty with correct schema
        return pl.DataFrame(
            schema={
                "user2_id": pl.Utf8,
                "conv1": pl.Struct(
                    {
                        "row_idx": pl.UInt32,
                        "conversation_id": pl.Utf8,
                        "title": pl.Utf8,
                        "summary": pl.Utf8,
                        "start_date": pl.Utf8,
                        "start_time": pl.Utf8,
                    }
                ),
                "conv2": pl.Struct(
                    {
                        "row_idx": pl.UInt32,
                        "conversation_id": pl.Utf8,
                        "title": pl.Utf8,
                        "summary": pl.Utf8,
                        "start_date": pl.Utf8,
                        "start_time": pl.Utf8,
                    }
                ),
                "cosine_similarity": pl.Float32,
            }
        )
    emb1_array = np.array(emb1_list, dtype=np.float32)
    current_user_avg_embedding = calculate_user_average_embedding(emb1_array)

    # Gather average embeddings for other users
    user_avg_embeddings = {}
    user_data = {}  # store (df, embeddings array)
    for other_uid in other_user_ids:
        try:
            df = load_user_dataframe(other_uid)
            if df.is_empty():
                continue
            df = df.with_row_count("row_idx")
            emb_list = df["embedding"].to_list()
            if not emb_list:
                continue
            emb_array = np.array(emb_list, dtype=np.float32)
            avg_emb = calculate_user_average_embedding(emb_array)
            user_avg_embeddings[other_uid] = avg_emb
            user_data[other_uid] = (df, emb_array)
        except Exception as e:
            logger.error(f"Error loading user {other_uid}: {e}")
            continue

    # Find top-K most similar users
    top_users = find_top_k_users(
        current_user_avg_embedding, user_avg_embeddings, config.top_k_users
    )

    # Filter to those whose similarity is actually > 0 (or some threshold).
    # If you'd like a cutoff for user-level similarity, apply it here:
    # e.g. top_users = [(uid, sim) for (uid, sim) in top_users if sim >= some_threshold]
    if not top_users:
        logger.info("No similar users found.")
        return pl.DataFrame(
            schema={
                "user2_id": pl.Utf8,
                "conv1": pl.Struct(
                    {
                        "row_idx": pl.UInt32,
                        "conversation_id": pl.Utf8,
                        "title": pl.Utf8,
                        "summary": pl.Utf8,
                        "start_date": pl.Utf8,
                        "start_time": pl.Utf8,
                    }
                ),
                "conv2": pl.Struct(
                    {
                        "row_idx": pl.UInt32,
                        "conversation_id": pl.Utf8,
                        "title": pl.Utf8,
                        "summary": pl.Utf8,
                        "start_date": pl.Utf8,
                        "start_time": pl.Utf8,
                    }
                ),
                "cosine_similarity": pl.Float32,
            }
        )

    all_pairs = []
    high_cutoff = config.high_cutoff
    low_cutoff = config.low_cutoff
    negative_threshold = -low_cutoff

    for other_uid, user_user_sim in top_users:
        df2, emb2_array = user_data[other_uid]
        logger.info(f"Processing conversation-level matching for user {other_uid}.")

        n1 = emb1_array.shape[0]
        n2 = emb2_array.shape[0]

        # 1) Compute full NxM similarity matrix
        sim_matrix = compute_pairwise_similarities(emb1_array, emb2_array)

        # --- Positive pass ---
        # Collect candidates with similarity >= high_cutoff
        pos_candidates = []
        for i in range(n1):
            for j in range(n2):
                sim = sim_matrix[i, j]
                if sim >= high_cutoff:
                    pos_candidates.append((i, j, sim))

        pos_matches = greedy_bipartite_match(pos_candidates, n1, n2)
        matched_user1 = {m[0] for m in pos_matches}
        matched_user2 = {m[1] for m in pos_matches}

        # --- Negative pass ---
        # We'll match leftover items from user1 and user2 with similarity <= low_cutoff
        # by negating the second user's embeddings and looking for sim >= negative_threshold
        # in the negated space.
        unmatched_user1 = [i for i in range(n1) if i not in matched_user1]
        unmatched_user2 = [j for j in range(n2) if j not in matched_user2]

        neg_candidates = []
        if unmatched_user1 and unmatched_user2:
            # We can extract sub-embeddings for leftover items
            emb1_left = emb1_array[unmatched_user1]
            emb2_left = emb2_array[unmatched_user2]
            # Negate user2 leftover
            emb2_left_neg = -emb2_left

            # Compute similarity in negative space
            neg_sim_matrix = np.matmul(emb1_left, emb2_left_neg.T)
            # Build candidate list
            for ii_idx, i in enumerate(unmatched_user1):
                for jj_idx, j in enumerate(unmatched_user2):
                    neg_sim = neg_sim_matrix[ii_idx, jj_idx]
                    # If neg_sim >= negative_threshold => original sim <= low_cutoff
                    if neg_sim >= negative_threshold:
                        neg_candidates.append(
                            (i, j, -neg_sim)
                        )  # store original sim as negative

            # Now we do bipartite matching in "negative space," but for clarity
            # we can just run the same function. We want to *sort by descending neg_sim*,
            # so we pass a direct list of (i, j, neg_sim).  We'll store the final matched
            # pairs with "original similarity" = -neg_sim so that it's the actual numeric
            # similarity in original space.

            # Sort descending by negative similarity
            neg_candidates.sort(key=lambda x: x[2], reverse=True)
            # But we need a standard call to greedy_bipartite_match, which expects (i,j,similarity).
            # That function will do the sorting inside it, so let's just pass them in the form it wants:
            matches_neg_space = greedy_bipartite_match(neg_candidates, n1, n2)
            # matches_neg_space have (i, j, neg_sim). We want to convert neg_sim to original space:
            neg_matches = [(i, j, -neg_sim) for (i, j, neg_sim) in matches_neg_space]
        else:
            neg_matches = []

        # Combine positive and negative pass matches
        user_matches = pos_matches + neg_matches

        # Build final records for polars
        for i, j, sim in user_matches:
            # Pull row from user1
            user1_conv = (
                current_user_df.filter(pl.col("row_idx") == i)
                .select(
                    "row_idx",
                    "conversation_id",
                    "title",
                    "summary",
                    "start_date",
                    "start_time",
                )
                .row(0, named=True)
            )
            # Pull row from user2
            user2_conv = (
                df2.filter(pl.col("row_idx") == j)
                .select(
                    "row_idx",
                    "conversation_id",
                    "title",
                    "summary",
                    "start_date",
                    "start_time",
                )
                .row(0, named=True)
            )

            all_pairs.append(
                {
                    "user2_id": other_uid,
                    "conv1": user1_conv,
                    "conv2": user2_conv,
                    "cosine_similarity": float(sim),
                }
            )

    if all_pairs:
        result_df = pl.DataFrame(
            all_pairs,
            schema={
                "user2_id": pl.Utf8,
                "conv1": pl.Struct(
                    {
                        "row_idx": pl.UInt32,
                        "conversation_id": pl.Utf8,
                        "title": pl.Utf8,
                        "summary": pl.Utf8,
                        "start_date": pl.Utf8,
                        "start_time": pl.Utf8,
                    }
                ),
                "conv2": pl.Struct(
                    {
                        "row_idx": pl.UInt32,
                        "conversation_id": pl.Utf8,
                        "title": pl.Utf8,
                        "summary": pl.Utf8,
                        "start_date": pl.Utf8,
                        "start_time": pl.Utf8,
                    }
                ),
                "cosine_similarity": pl.Float32,
            },
        )

        # Apply max_pairs_per_user limit by removing pairs closest to either threshold
        if len(result_df) > config.max_pairs_per_user:
            logger.info(
                f"Reducing from {len(result_df)} to {config.max_pairs_per_user} pairs"
            )

            # Calculate distance to nearest threshold for each pair
            result_df = result_df.with_columns(
                pl.when(pl.col("cosine_similarity") >= high_cutoff)
                .then(
                    pl.col("cosine_similarity") - high_cutoff
                )  # Distance above high threshold
                .otherwise(
                    low_cutoff - pl.col("cosine_similarity")
                )  # Distance below low threshold
                .abs()
                .alias("threshold_distance")
            )

            # Sort by threshold_distance (descending) to keep pairs furthest from thresholds
            result_df = result_df.sort("threshold_distance", descending=True)

            # Keep only max_pairs_per_user rows
            result_df = result_df.head(config.max_pairs_per_user)

            # Remove the temporary column
            result_df = result_df.drop("threshold_distance")

        # Sort final results by similarity
        return result_df.sort("cosine_similarity", descending=True)
    else:
        return pl.DataFrame(
            schema={
                "user2_id": pl.Utf8,
                "conv1": pl.Struct(
                    {
                        "row_idx": pl.UInt32,
                        "conversation_id": pl.Utf8,
                        "title": pl.Utf8,
                        "summary": pl.Utf8,
                        "start_date": pl.Utf8,
                        "start_time": pl.Utf8,
                    }
                ),
                "conv2": pl.Struct(
                    {
                        "row_idx": pl.UInt32,
                        "conversation_id": pl.Utf8,
                        "title": pl.Utf8,
                        "summary": pl.Utf8,
                        "start_date": pl.Utf8,
                        "start_time": pl.Utf8,
                    }
                ),
                "cosine_similarity": pl.Float32,
            }
        )
