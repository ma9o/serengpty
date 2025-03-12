import math
from typing import Dict

import numpy as np

from data_pipeline.assets.ai_conversations.utils.find_top_k_users import (
    get_bipartite_match,
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


FINITE_INF = 9999.9


def calculate_balance_scores(
    embeddings_current: list[np.ndarray],
    embeddings_other: list[np.ndarray],
) -> tuple[float, Dict[str, float]]:
    """Calculate balance score based on remaining conversations.

    Returns a score that prioritizes:
    1. Larger total number of conversations
    2. More balanced ratio between sides
    Lower scores are better.
    """
    len_current = len(embeddings_current)
    len_other = len(embeddings_other)
    if len_other == 0 or len_current == 0:
        return FINITE_INF, {
            "imbalance": FINITE_INF,
            "magnitude_factor": FINITE_INF,
            "dist": FINITE_INF,
        }  # Deprioritize if either side has no conversations

    # Calculate imbalance penalty (smaller is better)
    ratio = len_current / len_other
    imbalance = abs(math.log(ratio))

    # Calculate magnitude bonus (larger total is better)
    # total_conversations = len_current + len_other
    # magnitude_factor = 1 / total_conversations  # Inverse so smaller is better

    # Disable magnitude factor for now
    magnitude_factor = 0.0

    # Calculate cosine similarity between embeddings
    sim = get_bipartite_match(np.array(embeddings_current), np.array(embeddings_other))
    dist = 1 - sim

    return float(imbalance) + float(magnitude_factor) + float(dist), {
        "imbalance": float(imbalance),
        "magnitude_factor": float(magnitude_factor),
        "dist": float(dist),
    }
