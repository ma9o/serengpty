import math
from typing import Dict, Set

import numpy as np

from data_pipeline.assets.ai_conversations.utils.find_top_k_users import (
    get_approx_bipartite_match,
)

WEIGHTS = {
    "imbalance": 1,
    "magnitude_factor": 1,
    "dist": 1,
}


def sum_balance_scores(imbalance: float, magnitude_factor: float, dist: float) -> float:
    return sum(
        WEIGHTS[k] * v
        for k, v in {
            "imbalance": imbalance,
            "magnitude_factor": magnitude_factor,
            "dist": dist,
        }.items()
    )


def calculate_balance_scores(
    data: Dict,
    exclusions: Set[int],
) -> tuple[float, Dict[str, float]]:
    """Calculate balance score based on remaining conversations.

    Returns a score that prioritizes:
    1. Larger total number of conversations
    2. More balanced ratio between sides
    Lower scores are better.
    """
    embeddings_current = [
        s["embedding"]
        for s in data["current_summaries"]
        if s["row_idx"] not in exclusions
    ]
    embeddings_other = [
        s["embedding"] for s in data["summaries"] if s["row_idx"] not in exclusions
    ]
    len_current = len(embeddings_current)
    len_other = len(embeddings_other)
    if len_other == 0 or len_current == 0:
        return float("inf"), {
            "imbalance": float("inf"),
            "magnitude_factor": float("inf"),
            "dist": float("inf"),
        }  # Deprioritize if either side has no conversations

    # Calculate imbalance penalty (smaller is better)
    ratio = len_current / len_other
    imbalance = abs(math.log(ratio))

    # Calculate magnitude bonus (larger total is better)
    total_conversations = len_current + len_other
    # magnitude_factor = 1 / total_conversations  # Inverse so smaller is better
    magnitude_factor = 0

    # Calculate cosine similarity between embeddings
    sim = get_approx_bipartite_match(
        np.array(embeddings_current), np.array(embeddings_other)
    )
    dist = 1 - sim

    return imbalance + magnitude_factor + dist, {
        "imbalance": imbalance,
        "magnitude_factor": magnitude_factor,
        "dist": dist,
    }
