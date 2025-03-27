import datetime
import uuid

import polars as pl
from dagster import AssetExecutionContext, AssetIn, asset

from data_pipeline.partitions import user_partitions_def
from data_pipeline.resources.postgres_resource import PostgresResource


@asset(
    partitions_def=user_partitions_def,
    ins={
        "serendipity_optimized": AssetIn(key="serendipity_optimized"),
        "user_similarities": AssetIn(key="user_similarities"),
        "conversation_pair_clusters": AssetIn(key="conversation_pair_clusters"),
    },
    io_manager_key="parquet_io_manager",
)
def final(
    context: AssetExecutionContext,
    serendipity_optimized: pl.DataFrame,
    user_similarities: pl.DataFrame,
    conversation_pair_clusters: pl.DataFrame,
    postgres: PostgresResource,
) -> None:
    """
    This asset implements the same logic as your "savePipelineResults" using raw SQL
    in psycopg3 executemany, fully aligned with the final Drizzle migration schema:

    - users_matches <-> users pivot: "users_to_users_matches"(user_id, users_match_id)
    - serendipitous_paths <-> conversations pivot: "conversations_to_serendipitous_paths"(conversation_id, serendipitous_path_id)
    - user_paths <-> conversations pivot: "conversations_to_user_paths"(conversation_id, user_path_id)
    """
    # current_user_id is typically stored in the partition key
    current_user_id = context.partition_key

    # Convert polars DataFrames to Python lists of dicts
    so_rows = serendipity_optimized.to_dicts()
    sim_rows = user_similarities.to_dicts()
    cpc_rows = conversation_pair_clusters.to_dicts()

    # 1) Filter invalid rows in SerendipityOptimized
    filtered_so_rows = []
    for row in so_rows:
        if (
            row.get("common_conversation_ids")
            and row.get("user1_conversation_ids")
            and row.get("user2_conversation_ids")
            and row.get("user1_id")
            and row.get("user2_id")
        ):
            filtered_so_rows.append(row)
        else:
            context.log.warning(f"Skipping invalid SerendipityOptimized row: {row}")

    # 2) Build a quick map of userSimilarities: user_id -> similarity
    similarity_map = {r["user_id"]: r["similarity"] for r in sim_rows}

    # 3) Build conversation data for bulk insert
    conversation_data = []
    for row in cpc_rows:
        title = row.get("title") or "No title"
        summary = row.get("summary") or "No summary"

        # Parse date/time into a Python datetime object; fallback to now() if parsing fails
        try:
            dt_str = f"{row['start_date']}T{row['start_time']}"
            dt_obj = datetime.datetime.fromisoformat(dt_str)
        except Exception as ex:
            context.log.warning(
                f"Failed to parse datetime for row {row}. Reason: {ex}. "
                f"Using current time as fallback."
            )
            dt_obj = datetime.datetime.now()

        # Ensure conversation_id is set; generate a UUID if missing
        conversation_id = row.get("conversation_id") or str(uuid.uuid4())
        conversation_data.append(
            (
                conversation_id,
                title,
                summary,
                dt_obj,
                row["user_id"],
            )
        )

    # 4) Group SerendipityOptimized rows by match_group_id
    match_groups = {}
    for row in filtered_so_rows:
        mgid = row["match_group_id"]
        match_groups.setdefault(mgid, []).append(row)

    match_group_to_usersmatch = {}
    path_data = []
    user_path_data = []

    try:
        with postgres.get_connection() as conn, conn.cursor() as cur:
            # -----------------------------------------------------------------
            # STEP 1: Bulk create conversations (ON CONFLICT DO NOTHING)
            # -----------------------------------------------------------------
            if conversation_data:
                insert_conv_sql = """
                    INSERT INTO conversations
                        (id, title, summary, datetime, user_id, updated_at, created_at)
                    VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                    ON CONFLICT (id) DO NOTHING
                """
                cur.executemany(insert_conv_sql, conversation_data)

            # -----------------------------------------------------------------
            # STEP 2 & 3: Find or create users_matches (M:N with "users")
            #  Using pivot "users_to_users_matches"(user_id, users_match_id)
            # -----------------------------------------------------------------
            def find_existing_users_match(u1, u2):
                sql = """
                    SELECT m.id, m.score
                    FROM users_matches m
                    JOIN users_to_users_matches j1 ON j1.users_match_id = m.id
                    JOIN users_to_users_matches j2 ON j2.users_match_id = m.id
                    WHERE j1.user_id = %s
                      AND j2.user_id = %s
                    GROUP BY m.id
                """
                cur.execute(sql, (u1, u2))
                return cur.fetchone()  # (match_id, score) or None

            def upsert_users_match(user1_id, user2_id, similarity):
                existing = find_existing_users_match(user1_id, user2_id)
                if existing:
                    existing_id = existing["id"]
                    _existing_score = existing["score"]
                    update_sql = """
                        UPDATE users_matches
                        SET score = %s,
                            updated_at = NOW()
                        WHERE id = %s
                        RETURNING id
                    """
                    cur.execute(update_sql, (similarity, existing_id))
                    result = cur.fetchone()
                    if result is None:
                        cur.execute(
                            "SELECT id FROM users_matches WHERE id = %s", (existing_id,)
                        )
                        result = cur.fetchone()
                        if result is None:
                            raise Exception(
                                f"Failed to update users_matches row for id {existing_id}"
                            )
                    return result["id"]
                else:
                    new_id = str(uuid.uuid4())
                    insert_sql = """
                        INSERT INTO users_matches (id, score, updated_at, created_at)
                        VALUES (%s, %s, NOW(), NOW())
                        RETURNING id
                    """
                    cur.execute(insert_sql, (new_id, similarity))
                    result = cur.fetchone()
                    if result is None:
                        cur.execute(
                            "SELECT id FROM users_matches WHERE id = %s", (new_id,)
                        )
                        result = cur.fetchone()
                        if result is None:
                            raise Exception(
                                f"Failed to insert new users_matches row for id {new_id}"
                            )
                    context.log.info(result)
                    new_id_returned = result["id"]
                    join_sql = """
                        INSERT INTO users_to_users_matches (user_id, users_match_id)
                        VALUES (%s, %s), (%s, %s)
                    """
                    cur.execute(
                        join_sql, (user1_id, new_id_returned, user2_id, new_id_returned)
                    )
                    return new_id_returned

            for mgid, rows in match_groups.items():
                user1_id = rows[0]["user1_id"]
                user2_id = rows[0]["user2_id"]

                # Ensure currentUserId is either user1_id or user2_id
                if user1_id != current_user_id and user2_id != current_user_id:
                    raise ValueError(
                        f"Neither user1_id nor user2_id matches currentUserId={current_user_id} "
                        f"for match_group_id={mgid}"
                    )

                # The "other" user is the one not matching currentUserId
                other_user_id = user2_id if user1_id == current_user_id else user1_id
                similarity = similarity_map.get(other_user_id)
                if similarity is None:
                    raise ValueError(
                        f"Similarity not found for user {other_user_id} (match_group_id={mgid})"
                    )

                users_match_id = upsert_users_match(user1_id, user2_id, similarity)
                match_group_to_usersmatch[mgid] = users_match_id

            # -----------------------------------------------------------------
            # STEP 4,5,6: Upsert serendipitous_paths + user_paths
            # -----------------------------------------------------------------
            for mgid, rows in match_groups.items():
                users_match_id = match_group_to_usersmatch[mgid]
                for row in rows:
                    # Ensure path_id is a valid UUID; generate if missing
                    if not row.get("path_id"):
                        row["path_id"] = str(uuid.uuid4())

                    path_data.append(
                        {
                            "id": row["path_id"],
                            "title": row["path_title"],
                            "common_summary": row["path_description"],
                            "category": row["category"],
                            "balance_score": row["balance_score"],
                            "is_sensitive": row["is_sensitive"],
                            "users_match_id": users_match_id,
                            "common_conversation_ids": row["common_conversation_ids"],
                        }
                    )

                    # Generate UUIDs for user_paths records
                    user_path_data.append(
                        {
                            "id": str(uuid.uuid4()),
                            "user_id": row["user1_id"],
                            "path_id": row["path_id"],
                            "unique_summary": row["user1_unique_branches"],
                            "unique_call_to_action": row["user1_call_to_action"],
                            "unique_conversation_ids": row["user1_conversation_ids"],
                        }
                    )
                    user_path_data.append(
                        {
                            "id": str(uuid.uuid4()),
                            "user_id": row["user2_id"],
                            "path_id": row["path_id"],
                            "unique_summary": row["user2_unique_branches"],
                            "unique_call_to_action": row["user2_call_to_action"],
                            "unique_conversation_ids": row["user2_conversation_ids"],
                        }
                    )

            # -----------------------------------------------------------------
            # Upsert serendipitous_paths + link with conversations in
            # "conversations_to_serendipitous_paths"(conversation_id, serendipitous_path_id)
            # -----------------------------------------------------------------
            def upsert_serendipitous_path(p):
                upsert_sql = """
                    INSERT INTO serendipitous_paths(
                        id, title, common_summary, category,
                        balance_score, is_sensitive, users_match_id, created_at, updated_at
                    )
                    VALUES (
                        %(id)s, %(title)s, %(common_summary)s, %(category)s,
                        %(balance_score)s, %(is_sensitive)s, %(users_match_id)s, NOW(), NOW()
                    )
                    ON CONFLICT (id)
                    DO UPDATE SET
                        title = EXCLUDED.title,
                        common_summary = EXCLUDED.common_summary,
                        category = EXCLUDED.category,
                        balance_score = EXCLUDED.balance_score,
                        is_sensitive = EXCLUDED.is_sensitive,
                        users_match_id = EXCLUDED.users_match_id,
                        updated_at = NOW()
                    RETURNING id
                """
                cur.execute(upsert_sql, p)
                result = cur.fetchone()
                if result is None:
                    raise Exception(
                        f"Failed to upsert serendipitous_paths for id {p['id']}"
                    )
                path_id = result["id"]

                # Remove existing conversation links for this path
                delete_join_sql = """
                    DELETE FROM conversations_to_serendipitous_paths
                    WHERE serendipitous_path_id = %s
                """
                cur.execute(delete_join_sql, (path_id,))

                # Re-insert if any "common_conversation_ids"
                if p["common_conversation_ids"]:
                    join_insert_sql = """
                        INSERT INTO conversations_to_serendipitous_paths (conversation_id, serendipitous_path_id)
                        VALUES (%s, %s)
                    """
                    # conversation_id, serendipitous_path_id
                    join_values = [
                        (conv_id, path_id) for conv_id in p["common_conversation_ids"]
                    ]
                    cur.executemany(join_insert_sql, join_values)

            for p in path_data:
                upsert_serendipitous_path(p)

            # -----------------------------------------------------------------
            # Upsert user_paths + link with conversations in
            # "conversations_to_user_paths"(conversation_id, user_path_id)
            # -----------------------------------------------------------------
            def upsert_user_path(up):
                upsert_sql = """
                    INSERT INTO user_paths(
                        id, user_id, path_id,
                        unique_summary, unique_call_to_action, created_at, updated_at
                    )
                    VALUES (
                        %(id)s, %(user_id)s, %(path_id)s,
                        %(unique_summary)s, %(unique_call_to_action)s, NOW(), NOW()
                    )
                    ON CONFLICT (user_id, path_id)
                    DO UPDATE SET
                        unique_summary = EXCLUDED.unique_summary,
                        unique_call_to_action = EXCLUDED.unique_call_to_action,
                        updated_at = NOW()
                    RETURNING id
                """
                cur.execute(upsert_sql, up)
                result = cur.fetchone()
                if result is None:
                    raise Exception(
                        f"Failed to upsert user_paths for user_id {up['user_id']} and path_id {up['path_id']}"
                    )
                user_path_id = result["id"]

                # Remove existing conversation links for this user_path
                del_sql = """
                    DELETE FROM conversations_to_user_paths
                    WHERE user_path_id = %s
                """
                cur.execute(del_sql, (user_path_id,))

                # Re-insert if any "unique_conversation_ids"
                if up["unique_conversation_ids"]:
                    join_insert_sql = """
                        INSERT INTO conversations_to_user_paths (conversation_id, user_path_id)
                        VALUES (%s, %s)
                    """
                    # conversation_id, user_path_id
                    join_values = [
                        (conv_id, user_path_id)
                        for conv_id in up["unique_conversation_ids"]
                    ]
                    cur.executemany(join_insert_sql, join_values)

            for up in user_path_data:
                upsert_user_path(up)

            # Commit all changes
            conn.commit()

    except Exception as e:
        context.log.error(f"Error saving pipeline data via raw SQL: {e!r}")
        raise
