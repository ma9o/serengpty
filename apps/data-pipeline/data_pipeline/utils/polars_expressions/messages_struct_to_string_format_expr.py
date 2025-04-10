import polars as pl

from data_pipeline.utils.get_messaging_partners import MessagingPartners


def get_messages_struct_to_string_format_expr(
    messaging_partners: MessagingPartners
) -> pl.Expr:
    return (
        pl.col("messages_struct")
        .list.eval(
            pl.concat_str(
                [
                    pl.when(pl.element().struct.field("from").eq("me"))
                    .then(pl.lit(messaging_partners.initiator_name))
                    .otherwise(pl.element().struct.field("from")),
                    # pl.lit(", To: "),
                    # pl.when(pl.element().struct.field("to").eq("me"))
                    # .then(pl.lit(messaging_partners.me))
                    # .otherwise(pl.element().struct.field("to")),
                    pl.lit(" at "),
                    pl.element().struct.field("date"),
                    pl.lit(" "),
                    pl.element().struct.field("time"),
                    pl.lit(": "),
                    pl.element().struct.field("content"),
                ]
            )
        )
        .list.join("\n")
    )
