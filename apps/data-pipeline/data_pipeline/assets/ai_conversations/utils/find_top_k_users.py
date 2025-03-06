import heapq

import faiss
import numpy as np
import polars as pl

from data_pipeline.constants.environments import DAGSTER_STORAGE_DIRECTORY


def load_user_dataframe(user_id: str) -> pl.DataFrame:
    """Load a user's dataframe from Parquet."""
    return pl.read_parquet(
        DAGSTER_STORAGE_DIRECTORY / "conversations_embeddings" / f"{user_id}.snappy"
    )


def load_user_embeddings(user_id):
    """Load user data and embeddings, returning a tuple of (df, embeddings_array)."""
    df = load_user_dataframe(user_id)
    if df.is_empty():
        return None, None

    df = df.with_row_count("row_idx")
    emb_list = df["embedding"].to_list()

    if not emb_list:
        return None, None

    emb_array = np.array(emb_list, dtype=np.float32)
    return df, emb_array


def get_approx_user_sim(
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
            similarity = get_approx_user_sim(
                current_user_embeddings, embeddings, sample_size
            )
            if len(top_k_heap) < top_k:
                heapq.heappush(top_k_heap, (similarity, user_id))
            elif similarity > top_k_heap[0][0]:
                heapq.heappushpop(top_k_heap, (similarity, user_id))

    # Sort the heap results in descending order
    top_k_users = sorted(top_k_heap, key=lambda x: x[0], reverse=True)
    return top_k_users


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
