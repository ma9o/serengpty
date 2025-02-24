import polars as pl

result = (
    result.join(invalid_results, on="conversation_id", how="anti")
    .with_columns(
        [
            # Extract the is_sensitive field as a separate column
            pl.col("raw_skeleton")
            .map_elements(lambda rs: rs["is_sensitive"])
            .alias("is_sensitive"),
            # Extract the conversation summary from the raw output
            pl.col("raw_skeleton")
            .map_elements(lambda rs: rs["summary"])
            .alias("summary"),
            # Create the skeleton column with the conversation Q/A details and the timestamp
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
