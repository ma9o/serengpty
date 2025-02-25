from typing import Dict, List, Set

import faiss
import numpy as np
import polars as pl
from dagster import AssetExecutionContext, AssetIn, asset
from json_repair import repair_json

from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.constants.environments import get_environment
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.batch_inference.base_llm_resource import (
    BaseLlmResource,
    PromptSequence,
)
from data_pipeline.utils.graph.build_graph_from_df import build_graph_from_df
from data_pipeline.utils.graph.save_graph import save_graph


def get_all_ancestors(node_id: int, caused_by_map: Dict[int, List[int]]) -> Set[int]:
    """
    Return all ancestors of `node_id` in the directed graph.
    caused_by_map is e.g. { row_id: [list_of_caused_by_row_ids], ... }
    We'll do a BFS/DFS up the chain.
    """
    visited = set()
    stack = [node_id]
    while stack:
        current = stack.pop()
        parents = caused_by_map.get(current, [])
        for p in parents:
            if p not in visited:
                visited.add(p)
                stack.append(p)
    return visited


def build_long_range_prompt(current_summary: str, candidates: list) -> PromptSequence:
    """
    Construct a prompt for the LLM to decide if any of these long-range candidate
    conversations caused the current one.
    """
    preceding_text = "\n".join(
        f"- row_id={c['row_id']}, summary={c['summary']}" for c in candidates
    )

    prompt = f"""\
You are given a *current* conversation, plus a list of older candidate conversations (each with a row_id and summary).
These candidate conversations are not currently in the causal chain for the current conversation.

Current conversation summary:
{current_summary}

Candidate conversations (potential long-range influences):
{preceding_text}

Task:
- Which of these candidate conversations (if any) are potential causes of the current conversation?
- "Caused" means the user is continuing or referencing the ideas/content from that older conversation.
- After your reasoning, return a JSON array of row_ids. If none apply, return "[]".
"""
    return [prompt]


def parse_caused_by_llm_output(completion: str) -> List[int]:
    """
    Same as before, parse the LLM's JSON output into a list of ints.
    """
    try:
        repaired = repair_json(completion, return_objects=True)
        if isinstance(repaired, list):
            return [int(x) for x in repaired]
        return []
    except Exception:
        return []


class LongRangeCausalityConfig(RowLimitConfig):
    # How many top results from FAISS for each conversation
    top_k_similar: int = 20
    # Similarity threshold (if using dot-product or cosine, adapt your logic)
    similarity_threshold: float = 0.6
    # Save raw LLM IO data if in local environment; used to attach the raw prompts and outputs.
    save_llm_io: bool = get_environment() == "LOCAL"
    save_graphml: bool = get_environment() == "LOCAL"


@asset(
    partitions_def=user_partitions_def,
    ins={"short_range_causality": AssetIn(key="short_range_causality")},
    io_manager_key="parquet_io_manager",
)
async def long_range_causality(
    context: AssetExecutionContext,
    config: LongRangeCausalityConfig,
    gpt4o_mini: BaseLlmResource,
    short_range_causality: pl.DataFrame,
) -> pl.DataFrame:
    """
    Extends the causal graph by identifying relationships between distant conversations.
    
    This asset:
    - Extends causality detection to distant conversations
    - Builds comprehensive knowledge graph with networkx
    - Traverses causal chains to find indirect relationships
    - Captures long-term patterns in user behavior
    - Outputs GraphML format for visualization tools
    
    Output columns:
    - All columns from short_range_causality
    - caused_by: Updated with long-range causal relationships
    - relationships: (when save_graphml=True) Graph edges for visualization
    
    Processing steps:
    - Build a FAISS index from all conversations
    - For each conversation, search for top K most similar older conversations
    - Exclude any conversation that is already in the causal chain
    - Ask the LLM if any of those candidates caused the current conversation
    - Append the newly found causes to the existing 'caused_by'
    - Generate a knowledge graph in GraphML format (optional)
    
    Args:
        context: The asset execution context
        config: Configuration for long-range causality detection
        gpt4o_mini: LLM resource for causality verification
        short_range_causality: DataFrame with short-range causality information
        
    Returns:
        DataFrame with comprehensive causality information and optional graph data
    """
    llm = gpt4o_mini
    logger = context.log

    df = short_range_causality.filter(pl.col("skeleton").is_not_null()).sort(
        ["start_date", "start_time"]
    )

    # Build a caused_by_map for BFS later: row_idx -> list of row_idxs
    caused_by_map = {}
    for row in df.iter_rows(named=True):
        row_idx = row["row_idx"]
        caused_by_list = row["caused_by"] or []
        caused_by_map[row_idx] = caused_by_list

    embeddings_list = df["embedding"].to_list()

    dim = len(embeddings_list[0])
    index = faiss.IndexFlatIP(dim)
    embedding_matrix = np.array(embeddings_list, dtype=np.float32)
    index.add(embedding_matrix)

    # Prepare to collect the updated caused_by info and raw LLM IO if enabled.
    updated_caused_by = [
        set(cb) for cb in df["caused_by"].to_list()
    ]  # sets for ease of updating

    # Build lists of prompt sequences and corresponding row indices.
    prompt_sequences = []
    row_idxs = []
    candidate_lists = []
    # Initialize placeholder for raw LLM outputs.
    llm_raw_outputs = [None for _ in range(df.height)]

    for row in df.iter_rows(named=True):
        current_idx = row["row_idx"]
        current_summary = row["summary"]
        # 1) Get all ancestors (already in causal chain).
        ancestors = get_all_ancestors(current_idx, caused_by_map)
        # Also exclude the conversation itself.
        ancestors.add(current_idx)

        # 2) Use FAISS to find top_k_similar older convos.
        current_embed = np.array([row["embedding"]], dtype=np.float32)
        distances, indices = index.search(current_embed, k=config.top_k_similar + 10)
        # (Extra candidates are fetched in case many are filtered out.)

        # 3) Filter out candidates: skip self, not strictly older, below threshold, in ancestors,
        #    OR occurring in the time window already analyzed by short-range.
        candidate_ids = []
        top_distances = distances[0]
        top_indices = indices[0]
        for idx_i, dist_i in zip(top_indices, top_distances):
            if idx_i == current_idx:
                continue  # Skip the conversation itself.
            if dist_i < config.similarity_threshold:
                continue
            if idx_i >= current_idx:
                continue  # Must be strictly older.
            cand_row = df.row(int(idx_i), named=True)
            if cand_row["start_date_int"] >= row["short_range_cutoff"]:
                continue
            if int(idx_i) in ancestors:
                continue
            candidate_ids.append((int(idx_i), dist_i))
            if len(candidate_ids) >= config.top_k_similar:
                break

        if not candidate_ids:
            # No candidates found; record a null prompt.
            prompt_sequences.append(None)
            row_idxs.append(current_idx)
            candidate_lists.append([])
            continue

        # 4) For each candidate, build a small dict with conversation_id and summary.
        cands_for_prompt = []
        for cid, _ in candidate_ids:
            # Directly use the FAISS candidate (physical row index) to get the row.
            cand_row = df.row(cid, named=True)
            cands_for_prompt.append(
                {
                    "row_id": cand_row["row_idx"],
                    "summary": cand_row["summary"],
                }
            )

        candidate_lists.append(cands_for_prompt)
        # 5) Build LLM prompt.
        prompt_seq = build_long_range_prompt(
            current_summary=current_summary,
            candidates=cands_for_prompt,
        )
        prompt_sequences.append(prompt_seq)
        row_idxs.append(current_idx)

    # Batch LLM call for all valid prompts.
    valid_indices = [i for i, ps in enumerate(prompt_sequences) if ps is not None]
    valid_prompts = [prompt_sequences[i] for i in valid_indices]

    logger.info(
        f"Number of convos for long-range causality check: {len(valid_prompts)}"
    )
    if not valid_prompts:
        # If no prompts to process, return with empty caused_by (and raw IO if enabled).
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
    logger.info(f"LLM long-range causality cost: ${cost:.2f}")

    # Parse each completion and update the caused_by list.
    for local_i, comp in enumerate(completions):
        global_i = valid_indices[local_i]
        if not comp:
            continue
        row_ids = parse_caused_by_llm_output(comp[-1])
        row_idx_for_df = row_idxs[global_i]
        updated_caused_by[row_idx_for_df].update(row_ids)
        if config.save_llm_io:
            llm_raw_outputs[row_idx_for_df] = comp

    # Convert the set-based caused_by to sorted lists.
    final_caused_by = [sorted(list(s)) for s in updated_caused_by]

    # Update the caused_by_map for correctness (if subsequent operations need it).
    for row_i, row in enumerate(df.iter_rows(named=True)):
        convo_id = row["conversation_id"]
        caused_by_map[convo_id] = final_caused_by[row_i]

    df_out = df.with_columns(pl.Series(name="caused_by", values=final_caused_by))

    if config.save_llm_io:
        raw_prompts = [ps if ps is not None else [] for ps in prompt_sequences]
        df_out = df_out.with_columns(
            [
                pl.Series(name="llm_raw_outputs", values=llm_raw_outputs),
                pl.Series(name="llm_raw_prompts", values=raw_prompts),
            ]
        )

    if config.save_graphml:
        # Add relationships col
        graph_df = df_out.with_columns(
            relationships=pl.concat_list(
                pl.col("row_idx"), pl.col("caused_by")
            ).map_elements(
                lambda pair: [{"source": pair[0], "target": i} for i in pair[1:]]
            ),
            start_date=pl.col("start_date").dt.to_string(),
        )
        G = build_graph_from_df(
            graph_df,
            "relationships",
            "row_idx",
            ["summary", "start_date", "start_time"],
        )
        save_graph(G, context)

    return df_out
