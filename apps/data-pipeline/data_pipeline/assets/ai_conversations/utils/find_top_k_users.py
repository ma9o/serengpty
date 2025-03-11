import heapq

import faiss
import numpy as np
from scipy.optimize import linear_sum_assignment

from data_pipeline.assets.ai_conversations.utils.load_user_dataframe import (
    load_user_dataframe,
)


def load_user_embeddings(user_id):
    """Load user data and embeddings, returning a tuple of (df, embeddings_array)."""
    df = load_user_dataframe(user_id, "conversations_embeddings")
    if df.is_empty():
        return None, None

    df = df.with_row_count("row_idx")
    emb_list = df["embedding"].to_list()

    if not emb_list:
        return None, None

    emb_array = np.array(emb_list, dtype=np.float32)
    return df, emb_array


def get_bipartite_match(
    current_user_embeddings: np.ndarray,
    user_embeddings: np.ndarray,
) -> float:
    """
    Compute bipartite similarity between two sets of embeddings, using maximum flow.

    Args:
        current_user_embeddings: Shape (n1, d), normalized embeddings for current user
        user_embeddings: Shape (n2, d), normalized embeddings for target user

    Returns:
        Float representing optimal bipartite similarity
    """

    assert current_user_embeddings.ndim == 2 and user_embeddings.ndim == 2
    assert current_user_embeddings.shape[1] == user_embeddings.shape[1]

    # Determine which set of embeddings to use as query vs. index
    # For efficiency, build index on the larger set
    if current_user_embeddings.shape[0] <= user_embeddings.shape[0]:
        query_embeddings = current_user_embeddings
        index_embeddings = user_embeddings
        query_is_current = True
    else:
        query_embeddings = user_embeddings
        index_embeddings = current_user_embeddings
        query_is_current = False

    # Build FAISS index with inner product similarity (for normalized vectors = cosine)
    index = faiss.IndexFlatIP(index_embeddings.shape[1])
    index.add(index_embeddings)

    # Compute all pairwise similarities
    # For each query embedding, get similarity to all index embeddings
    similarity_matrix = np.zeros((query_embeddings.shape[0], index_embeddings.shape[0]))
    for i, query_emb in enumerate(query_embeddings):
        # Reshape to (1, d) for FAISS
        query_emb = query_emb.reshape(1, -1)
        # Get similarities to all index embeddings
        distances, _ = index.search(query_emb, index_embeddings.shape[0])
        similarity_matrix[i] = distances[0]

    # Transpose if needed to maintain correct orientation
    if not query_is_current:
        similarity_matrix = similarity_matrix.T

    # Create cost matrix (negative similarity since linear_sum_assignment minimizes)
    cost_matrix = -similarity_matrix

    # Find optimal assignment
    row_ind, col_ind = linear_sum_assignment(cost_matrix)

    # Return average similarity from the optimal assignment
    optimal_sim = -np.mean(cost_matrix[row_ind, col_ind])
    return float(optimal_sim)


def get_approx_bipartite_match(
    current_user_embeddings: np.ndarray,
    user_embeddings: np.ndarray,
    sample_size: int = 100,
) -> float:
    """
    Compute average cosine similarity between two sets of embeddings using a sample.

    Args:
        current_user_embeddings: Shape (n1, d), normalized embeddings for current user
        user_embeddings: Shape (n2, d), normalized embeddings for target user
        sample_size: Number of embeddings to sample from current_user_embeddings (default: 100)

    Returns:
        Float representing average cosine similarity
    """
    assert current_user_embeddings.ndim == 2 and user_embeddings.ndim == 2
    assert current_user_embeddings.shape[1] == user_embeddings.shape[1]

    # Sample embeddings if sample_size is less than the total number available
    if sample_size < current_user_embeddings.shape[0]:
        indices = np.random.choice(
            current_user_embeddings.shape[0], sample_size, replace=False
        )
        search_embeddings = current_user_embeddings[indices]
    else:
        search_embeddings = current_user_embeddings

    # Build FAISS index with target user's embeddings
    index = faiss.IndexFlatIP(user_embeddings.shape[1])  # Inner product
    index.add(user_embeddings)

    # Search with sampled embeddings
    distances, _ = index.search(search_embeddings, 1)

    # Average the cosine similarities
    avg_cosine_sim = np.mean(distances[:, 0])
    return float(avg_cosine_sim)


def find_top_k_users(
    current_user_embeddings: np.ndarray,
    other_user_ids: list[str],
    top_k: int,
    sample_size: int = 100,
) -> list[tuple[str, float]]:
    """
    Find the top K most similar users by loading embeddings one at a time.

    Args:
        current_user_embeddings: Shape (n, d), normalized embeddings for current user
        other_user_ids: List of user IDs to compare against
        top_k: Number of top similar users to return
        sample_size: Number of embeddings to sample for similarity (default: 100)

    Returns:
        List of (user_id, similarity_score) sorted by similarity descending
    """
    if not other_user_ids:
        return []

    top_k_heap = []
    for user_id in other_user_ids:
        # Load embeddings for one user at a time
        df, embeddings = load_user_embeddings(
            user_id
        )  # Assume this function is available
        if embeddings is not None:
            similarity = get_approx_bipartite_match(
                current_user_embeddings, embeddings, sample_size
            )
            if len(top_k_heap) < top_k:
                heapq.heappush(top_k_heap, (similarity, user_id))
            elif similarity > top_k_heap[0][0]:
                heapq.heappushpop(top_k_heap, (similarity, user_id))

    # Sort the heap results in descending order
    top_k_users = sorted(top_k_heap, key=lambda x: x[0], reverse=True)
    return [(user_id, similarity) for similarity, user_id in top_k_users]


if __name__ == "__main__":
    import time

    from sklearn.preprocessing import normalize

    start_time = time.time()
    current_user_embeddings = np.random.rand(4096, 100)
    current_user_embeddings_norm = normalize(current_user_embeddings, axis=1)
    user_embeddings = {i: np.random.rand(4096, 100) for i in range(100)}
    user_embeddings_norm = {
        i: normalize(embeddings, axis=1) for i, embeddings in user_embeddings.items()
    }
    print(f"Time taken to create embeddings: {time.time() - start_time:.3f} seconds")

    start_time = time.time()
    top_k = find_top_k_users(current_user_embeddings_norm, user_embeddings_norm, 10)
    print("Top 10 similar users:", top_k)
    print(f"Time taken to find top k users: {time.time() - start_time:.3f} seconds")
