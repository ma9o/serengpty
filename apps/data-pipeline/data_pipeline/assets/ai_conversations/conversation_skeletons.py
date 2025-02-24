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


def get_conversation_skeleton_prompt_sequence(conversation: str) -> PromptSequence:
    return [
        # NB: do not use "user" or "assistant" in the prompt or it will throw a 500
        dedent(
            f"""
              You will be given a conversation between a user and an AI assistant.
              Sometimes, users paste content from an external source into their questions, such as articles, code snippets, etc.

              Your job is to provide a summary of the conversation that:
              - only preserves verbatim the user's manually written text
              - summarizes the assistant's responses and content that the user is likely to have pasted from an external source

              Format each exchange as:
              Q: what the user wrote in the question + [a concise summary of what the user pasted in the question, if any]
              A: concise summary of main response points

              Examples:

              For a question with no pasted content, just return the input verbatim and summarize the response:
              Q: "I've always stored my tomatoes in the fridge like my mom taught me - is this the best way to keep them fresh?"
              A: Recommends room temperature storage instead of refrigeration

              For a question with pasted content, return only the manually written part verbatim, summarize the external content, and summarize the response:
              Q: "My garden tomatoes are getting spots and I'm really worried about losing the whole crop. My grandfather taught me to always check the leaves first" + [Includes lengthy paste of disease identification guide from gardening website]
              A: Identifies likely early blight and suggests organic treatment options

              Additionally:
              1. If the conversation is not in English, translate it to English.
              2. Determine if the conversation is highly sensitive, containing topics such as physicial and mental health problems, relationship advice and private legal matters.
              3. Descriptively summarize what the user wants to do, without mentioning the AI assistant.

              Use this output schema:
              {{
                  "summary": str,
                  "is_sensitive": bool,
                  "skeleton": [
                      {{
                          "question": str,
                          "answer": str
                      }},
                      ...
                  ]
              }}

              Here is the conversation:
              {conversation}
            """
        ).strip(),
    ]


def parse_conversation_skeletons(completion: str) -> dict | None:
    try:
        res = repair_json(completion, return_objects=True)

        # Now expect a JSON object with an "is_sensitive" field and a "skeleton" list of Q/A dicts.
        if (
            isinstance(res, dict)
            and "is_sensitive" in res
            and "skeleton" in res
            and "summary" in res
            and isinstance(res["skeleton"], list)
            and all(
                isinstance(x, dict) and "question" in x and "answer" in x
                for x in res["skeleton"]
            )
        ):
            return res
        else:
            return None
    except Exception:
        return None


class ConversationSkeletonsConfig(RowLimitConfig):
    row_limit: int = 1500


@asset(
    partitions_def=user_partitions_def,
    ins={
        "parsed_conversations": AssetIn(
            key=["parsed_conversations"],
        ),
    },
    io_manager_key="parquet_io_manager",
    # op_tags=get_k8s_vllm_config(),
)
async def conversation_skeletons(
    context: AssetExecutionContext,
    config: ConversationSkeletonsConfig,
    gpt4o_mini: BaseLlmResource,
    parsed_conversations: pl.DataFrame,
):
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
            pl.struct([pl.col("date"), pl.col("time"), pl.col("question")]).alias(
                "datetime_question"
            ),
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
                pl.col("datetime_question").alias("datetime_questions"),
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
        get_conversation_skeleton_prompt_sequence(row["datetime_conversations"])
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
            "raw_skeleton": parse_conversation_skeletons(completion[-1])
            if completion
            else None
        }
        for completion in summaries_completions
    ]

    result = df.hstack(pl.DataFrame(results, strict=False))

    invalid_results = result.filter(pl.col("raw_skeleton").is_null())

    if invalid_results.height > 0:
        logger.warning(f"DOOT DOOT: Found invalid {invalid_results.height} skeletons.")

    result = (
        result.join(invalid_results, on="conversation_id", how="anti")
        .with_columns(
            [
                pl.col("raw_skeleton")
                .map_elements(lambda rs: rs["is_sensitive"])
                .alias("is_sensitive"),
                pl.col("raw_skeleton")
                .map_elements(lambda rs: rs["summary"])
                .alias("summary"),
                pl.struct(["datetime_questions", "raw_skeleton"])
                .map_elements(
                    lambda row: [
                        {
                            "question": skel["question"],
                            "answer": skel["answer"],
                            "date": dtq["date"],
                            "time": dtq["time"],
                        }
                        for dtq, skel in zip(
                            row["datetime_questions"], row["raw_skeleton"]["skeleton"]
                        )
                    ],
                )
                .alias("skeleton"),
            ]
        )
        .drop("raw_skeleton")
    )

    return result
