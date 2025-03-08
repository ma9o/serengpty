from textwrap import dedent

import polars as pl
from dagster import (
    AssetExecutionContext,
    AssetIn,
    asset,
)
from json_repair import repair_json

from data_pipeline.constants.custom_config import RowLimitConfig
from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.batch_inference.base_llm_resource import (
    BaseLlmResource,
    PromptSequence,
)


def get_conversation_summary_prompt_sequence(conversation: str) -> PromptSequence:
    return [
        # NB: do not use "user" or "assistant" in the prompt or it will throw a 500
        dedent(
            f"""
              You will be given a conversation between a user and an AI assistant.

              Your job is to provide a summary as follows:
              1. Provide a summary that describes the progression of the conversation and what the user obtains at the end.
              2. Determine if the conversation is highly sensitive, containing topics such as physical and mental health problems, relationship advice, erotic content, private legal matters, etc.
              3. If the conversation is not in English, your summary should be in English.
              4. Keep it under 150 words.
              5. In the summary, every occurrence of "the user" should be replaced with "<USER>"


              Use this output schema:
              {{
                  "summary": str,
                  "is_sensitive": bool,
              }}

              Here is the conversation:
              {conversation}
            """
        ).strip(),
    ]


def parse_conversation_summaries(completion: str) -> dict | None:
    try:
        res = repair_json(completion, return_objects=True)

        # Now expect a JSON object with "is_sensitive", "summary" fields.
        if (
            isinstance(res, dict)
            and "is_sensitive" in res
            and "summary" in res
            and isinstance(res["is_sensitive"], bool)
            and isinstance(res["summary"], str)
        ):
            return res
        else:
            return None
    except Exception:
        return None


class ConversationSummariesConfig(RowLimitConfig):
    row_limit: int = 1500


@asset(
    partitions_def=user_partitions_def,
    ins={
        "parsed_conversations": AssetIn(
            key=["parsed_conversations"],
        ),
    },
    io_manager_key="parquet_io_manager",
    pool="gpt4o_mini",
    # op_tags=get_k8s_vllm_config(),
)
async def conversation_summaries(
    context: AssetExecutionContext,
    config: ConversationSummariesConfig,
    gpt4o_mini: BaseLlmResource,
    parsed_conversations: pl.DataFrame,
):
    """
    Creates simplified summaries of conversations using LLM.

    This asset:
    - Creates concise summaries of conversations using LLM (gpt4o_mini)
    - Groups by conversation_id to maintain context across exchanges
    - Flags sensitive content for privacy protection
    - Essential for quick understanding of conversation content

    Output columns:
    - conversation_id: Unique identifier for each conversation
    - title: The title of the conversation
    - start_date: Date when the conversation started
    - start_time: Time when the conversation started
    - datetime_conversations: Combined date/time/question/answer text
    - is_sensitive: Boolean flag for sensitive content
    - summary: LLM-generated conversation summary
    """
    llm = gpt4o_mini
    logger = context.log

    df = (
        parsed_conversations.sort("date", "time")
        .with_columns(
            pl.concat_str(
                [
                    pl.col("date"),
                    pl.lit(" at "),
                    pl.col("time"),
                    pl.lit("\n QUESTION: "),
                    pl.col("question"),
                    pl.lit("\n ANSWER: "),
                    pl.col("answer"),
                ],
            ).alias("datetime_conversation"),
        )
        .group_by("conversation_id")
        .agg(
            [
                pl.col("datetime_conversation")
                .str.concat("\n\n")
                .alias("datetime_conversations"),
                pl.col("title").first(),
                pl.col("date").first().alias("start_date"),
                pl.col("time").first().alias("start_time"),
            ]
        )
        .sort("start_date", "start_time", descending=True)
        # TODO: why are there nulls?
        .filter(
            pl.col("datetime_conversations").is_not_null()
            & (pl.col("datetime_conversations").str.len_chars() > 1)
        )
        .slice(0, config.row_limit)
    )

    prompt_sequences = [
        get_conversation_summary_prompt_sequence(row["datetime_conversations"])
        for row in df.to_dicts()
    ]

    logger.info(f"Processing {len(prompt_sequences)} conversations...")

    (
        summaries_completions,
        cost,
    ) = llm.get_prompt_sequences_completions_batch(
        prompt_sequences,
    )

    logger.info(f"Done processing {len(prompt_sequences)} conversations.")
    logger.info(f"Execution cost: ${cost:.2f}")

    results = [
        {
            "raw_summary": parse_conversation_summaries(completion[-1])
            if completion
            else None
        }
        for completion in summaries_completions
    ]

    result = df.hstack(pl.DataFrame(results, strict=False))

    invalid_results = result.filter(pl.col("raw_summary").is_null())

    if invalid_results.height > 0:
        logger.warning(f"Found invalid {invalid_results.height} summaries.")

    result = (
        result.join(invalid_results, on="conversation_id", how="anti")
        .with_columns(
            [
                pl.col("raw_summary")
                .map_elements(lambda rs: rs["is_sensitive"])
                .alias("is_sensitive"),
                pl.col("raw_summary")
                .map_elements(lambda rs: rs["summary"])
                .alias("summary"),
            ]
        )
        .drop("raw_summary")
    )

    return result
