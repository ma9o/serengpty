from textwrap import dedent

import faiss
import numpy as np
import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    asset,
)
from json_repair import repair_json

from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.constants.environments import get_environment
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.batch_inference.base_llm_resource import (
    BaseLlmResource,
    PromptSequence,
)


def build_short_range_prompt(current_summary: str, candidates: list) -> PromptSequence:
    """
    Constructs a single prompt asking which subset of `candidates`
    caused the current conversation.

    The current conversation's summary is shown below.

    Each candidate is something like:
      {
         "row_id": int,
         "title": str,
      }
    """
    # Summaries of top K preceding conversations:
    preceding_text = "\n".join(
        f"- id:{c['row_id']}, summary:{c['summary']}" for c in candidates
    )

    prompt = dedent(f"""
    Identify which of these candidate preceding conversations (if any) likely prompted or inspired the user to start the *current* conversation.
    The preceding candidate conversations all occurred within the past week, so even weak connections can be meaningful.

    After your analysis, return a JSON array of row_ids for conversations that could have caused the current one.
    If none apply, return an empty JSON list "[]".

    Current conversation summary:
    {current_summary}

    Candidate preceding conversations:
    {preceding_text}
    """).strip()

    return [prompt]


def parse_caused_by_llm_output(completion: str) -> list[int]:
    """
    Attempt to parse the LLM output into a list of row_id integers.
    If invalid or empty, return an empty list.
    """
    try:
        repaired = repair_json(completion, return_objects=True)
        if isinstance(repaired, list):
            return [int(x) for x in repaired]
        return []
    except Exception:
        return []


class ShortRangeCausalityConfig(RowLimitConfig):
    # How many days to look back
    days_to_look_back: int = 7
    # How many preceding conversations to pass to LLM
    top_k_preceding: int = 20
    # Similarity threshold for filtering candidates
    similarity_threshold: float = 0.4

    save_llm_io: bool = get_environment() == "LOCAL"


@asset(
    partitions_def=user_partitions_def,
    ins={"skeletons_embeddings": AssetIn(key="skeletons_embeddings")},
    io_manager_key="parquet_io_manager",
)
async def short_range_causality(
    context: AssetExecutionContext,
    config: ShortRangeCausalityConfig,
    gpt4o_mini: BaseLlmResource,
    skeletons_embeddings: pl.DataFrame,
) -> pl.DataFrame:
    """
    Identifies short-range causal dependencies by:
    1) Filtering each conversation to the top K preceding convos within X days.
    2) Asking the LLM which of those K convos may have caused the current convo.
    3) Storing the resulting conversation_ids in a new caused_by column.

    When `config.save_llm_io` is True, the raw LLM outputs are saved in an additional
    'llm_raw_outputs' column for debugging. Additionally, the raw prompts are saved in
    'llm_raw_prompts' column.
    """
    llm = gpt4o_mini
    logger = context.log

    df = skeletons_embeddings.filter(pl.col("summary").is_not_null()).sort(
        ["start_date", "start_time"]
    )

    # Convert start_date to a pl.Date if not already
    df = df.with_columns(
        pl.col("start_date").str.strptime(pl.Date, "%Y-%m-%d", strict=False)
    )

    # Convert date to integer days for naive time window filtering
    df = df.with_columns((pl.col("start_date").cast(pl.Int32)).alias("start_date_int"))
    # Keep an index for reference
    df = df.with_row_count("row_idx")

    # We'll collect prompt sequences
    row_idxs = []
    prompt_sequences = []
    preceding_candidates_list = []

    for row in df.iter_rows(named=True):
        curr_idx = row["row_idx"]
        curr_date_int = row["start_date_int"]
        curr_summary = row["summary"]

        # 1) Filter preceding by time (within X days) and strictly older
        time_filtered = df.filter(
            (pl.col("start_date_int") >= (curr_date_int - config.days_to_look_back))
            & (pl.col("start_date_int") <= curr_date_int)
            & (pl.col("row_idx") < curr_idx)
        )

        if time_filtered.height == 0:
            row_idxs.append(curr_idx)
            prompt_sequences.append(None)
            preceding_candidates_list.append([])
            continue

        # 2) Sort descending by date/time
        time_filtered = time_filtered.sort(
            ["start_date", "start_time"], descending=True
        )

        # 3) Use FAISS to filter based on embedding similarity.
        # (Assumes a column "embedding" is present on the DataFrame.)

        # Get candidate embeddings as a numpy array and normalize them.
        candidate_embeddings = np.array(
            time_filtered["embedding"].to_list(), dtype=np.float32
        )
        if candidate_embeddings.shape[0] > 0:
            candidate_norms = np.linalg.norm(
                candidate_embeddings, axis=1, keepdims=True
            )
            candidate_embeddings = candidate_embeddings / (candidate_norms + 1e-9)

        # Get the current conversation's embedding and normalize it.
        current_embedding = np.array(row["embedding"], dtype=np.float32)
        current_norm = np.linalg.norm(current_embedding)
        if current_norm > 0:
            current_embedding = current_embedding / (current_norm + 1e-9)

        # Compute similarity scores using FAISS.
        if candidate_embeddings.shape[0] > 0 and candidate_embeddings.shape[1] > 0:
            d = candidate_embeddings.shape[1]
            index = faiss.IndexFlatIP(
                d
            )  # inner product index (assumes cosine similarity when vectors are normalized)
            index.add(candidate_embeddings)
            # Query using the current embedding. We use k equal to the number of candidates.
            k_candidates = candidate_embeddings.shape[0]
            D, I_order = index.search(current_embedding.reshape(1, d), k_candidates)
            # FAISS returns candidates sorted by decreasing similarity.
            # Rearrange the similarity scores to match the order of time_filtered.
            similarity_scores = np.empty(k_candidates, dtype=np.float32)
            for order, orig_idx in enumerate(I_order[0]):
                similarity_scores[orig_idx] = D[0, order]
        else:
            similarity_scores = np.array([])

        # 4) Select candidates that meet the similarity threshold.
        # First, pick the high-quality candidates.
        high_quality_idx = [
            i
            for i, sim in enumerate(similarity_scores)
            if sim >= config.similarity_threshold
        ]
        # Then, if necessary, use additional candidates that did not meet the threshold.
        low_quality_idx = [
            i
            for i, sim in enumerate(similarity_scores)
            if sim < config.similarity_threshold
        ]
        final_indices = high_quality_idx.copy()
        if len(final_indices) < config.top_k_preceding:
            needed = config.top_k_preceding - len(final_indices)
            final_indices.extend(low_quality_idx[:needed])

        # If no candidates selected (unlikely), then skip this conversation.
        if not final_indices:
            row_idxs.append(curr_idx)
            prompt_sequences.append(None)
            preceding_candidates_list.append([])
            continue

        # Select the candidates based on the computed indices.
        selected_candidates = time_filtered[final_indices]

        # Build the list for the prompt using row_idx as row_id.
        cand_list = []
        for cand_row in selected_candidates.iter_rows(named=True):
            cand_list.append(
                {
                    "row_id": cand_row["row_idx"],
                    "title": cand_row.get("title", ""),
                    "summary": cand_row["summary"],
                }
            )

        preceding_candidates_list.append(cand_list)
        # Create the prompt sequence only if we have candidates.
        if len(cand_list) == 0:
            row_idxs.append(curr_idx)
            prompt_sequences.append(None)
            continue

        prompt_seq = build_short_range_prompt(
            current_summary=curr_summary,
            candidates=cand_list,
        )
        prompt_sequences.append(prompt_seq)
        row_idxs.append(curr_idx)

    # Batch LLM calls
    valid_indices = [i for i, ps in enumerate(prompt_sequences) if ps is not None]
    valid_prompts = [prompt_sequences[i] for i in valid_indices]

    logger.info(
        f"Number of convos to check in short_range_causality: {len(valid_prompts)}"
    )

    if not valid_prompts:
        # No calls to make, just add empty caused_by (and optionally llm_raw_outputs and llm_raw_prompts)
        if config.save_llm_io:
            return df.with_columns(
                [
                    pl.lit([]).alias("caused_by"),
                    pl.lit([]).alias("llm_raw_outputs"),
                    pl.lit([]).alias("llm_raw_prompts"),
                ]
            )
        return df.with_columns(pl.lit([]).alias("caused_by"))

    completions, cost = llm.get_prompt_sequences_completions_batch(valid_prompts)
    logger.info(f"LLM short-range causality cost: ${cost:.2f}")

    # Initialize lists to hold results for all rows
    caused_by = [[] for _ in range(df.height)]
    raw_outputs = [None for _ in range(df.height)]

    # Parse completions
    for idx, comp in zip(valid_indices, completions):
        if not comp:
            continue
        # comp is a list of chunk(s); last chunk is final
        conversation_caused_by = parse_caused_by_llm_output(comp[-1])
        row_idx_for_df = row_idxs[idx]
        caused_by[row_idx_for_df] = conversation_caused_by
        if config.save_llm_io:
            raw_outputs[row_idx_for_df] = comp  # type: ignore

    df_out = df.with_columns(pl.Series(name="caused_by", values=caused_by))
    if config.save_llm_io:
        # Also record the raw prompt sequences (or empty list if none)
        raw_prompts = [ps if ps is not None else [] for ps in prompt_sequences]
        df_out = df_out.with_columns(
            [
                pl.Series(name="llm_raw_outputs", values=raw_outputs),
                pl.Series(name="llm_raw_prompts", values=raw_prompts),
            ]
        )

    # Add the short_range_cutoff column, computed as the lower bound used in short-range filtering.
    # Here we assume start_date_int is an integer representation of the date,
    # so the cutoff is: current row's start_date_int - config.days_to_look_back.
    df_out = df_out.with_columns(
        (pl.col("start_date_int") - config.days_to_look_back).alias(
            "short_range_cutoff"
        )
    )

    return df_out
