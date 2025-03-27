// libs/db/src/schema.ts

import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  timestamp,
  text,
  uuid,
  boolean,
  doublePrecision,
  integer,
  index,
  unique,
  primaryKey,
  halfvec,
  varchar,
} from 'drizzle-orm/pg-core';

// --- Tables  ---

export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull(),
  updated_at: timestamp('updated_at', { precision: 3, mode: 'date' })
    .notNull()
    .$onUpdate(() => new Date()),

  name: text('name').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  country: text('country').default('INTERNET').notNull(),
  sensitive_matching: boolean('sensitive_matching').default(false).notNull(),

  extension_api_key: varchar('extension_api_key', { length: 32 })
    .notNull()
    .default(sql`replace(gen_random_uuid()::text, '-', '')`),
});

export const conversationsTable = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' })
      .notNull()
      .$onUpdate(() => new Date()),

    title: text('title'), // Optional
    summary: text('summary'), // Optional
    content: text('content'), // Added, Optional
    datetime: timestamp('datetime', { precision: 3, mode: 'date' }), // Optional

    embedding: halfvec('embedding', { dimensions: 3072 }), // Optional, pgvector type

    user_id: uuid('user_id').references(() => usersTable.id, {
      // Optional reference
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
  },
  // Changed from object to array format
  (table) => [
    index('embedding_index').using(
      'hnsw',
      table.embedding.op('halfvec_cosine_ops')
    ),
    index('conversation_user_id_idx').on(table.user_id),
  ]
);

export const usersMatchesTable = pgTable('users_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull(),
  updated_at: timestamp('updated_at', { precision: 3, mode: 'date' })
    .notNull()
    .$onUpdate(() => new Date()),

  score: doublePrecision('score').notNull(),
  viewed: boolean('viewed').default(false).notNull(),
});

export const serendipitousPathsTable = pgTable('serendipitous_paths', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull(),
  updated_at: timestamp('updated_at', { precision: 3, mode: 'date' })
    .notNull()
    .$onUpdate(() => new Date()),

  title: text('title').notNull(),
  common_summary: text('common_summary').notNull(),
  category: text('category').notNull(),
  balance_score: doublePrecision('balance_score').notNull(),
  is_sensitive: boolean('is_sensitive').default(false).notNull(),

  users_match_id: uuid('users_match_id')
    .notNull()
    .references(() => usersMatchesTable.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
});

export const userPathsTable = pgTable(
  'user_paths',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' })
      .notNull()
      .$onUpdate(() => new Date()),

    unique_summary: text('unique_summary').notNull(),
    unique_call_to_action: text('unique_call_to_action').notNull(),

    user_id: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    path_id: uuid('path_id')
      .notNull()
      .references(() => serendipitousPathsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  // Changed from object to array format
  (table) => [
    unique('user_paths_user_id_path_id_key').on(table.user_id, table.path_id),
  ]
);

export const pathFeedbackTable = pgTable(
  'path_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' })
      .notNull()
      .$onUpdate(() => new Date()),

    score: integer('score').notNull(), // -1, 0, or 1

    user_id: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    path_id: uuid('path_id')
      .notNull()
      .references(() => serendipitousPathsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  // Changed from object to array format
  (table) => [
    unique('path_feedback_user_id_path_id_key').on(
      table.user_id,
      table.path_id
    ),
  ]
);

// --- Join Tables ---

export const usersToUsersMatchesTable = pgTable(
  'users_to_users_matches',
  {
    user_id: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    users_match_id: uuid('users_match_id')
      .notNull()
      .references(() => usersMatchesTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  // Changed from object to array format (though primaryKey isn't strictly affected by the deprecation notice, using array for consistency)
  (table) => [primaryKey({ columns: [table.user_id, table.users_match_id] })]
);

export const conversationsToSerendipitousPathsTable = pgTable(
  'conversations_to_serendipitous_paths',
  {
    conversation_id: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    serendipitous_path_id: uuid('serendipitous_path_id')
      .notNull()
      .references(() => serendipitousPathsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  // Changed from object to array format
  (table) => [
    primaryKey({
      columns: [table.conversation_id, table.serendipitous_path_id],
    }),
  ]
);

export const conversationsToUserPathsTable = pgTable(
  'conversations_to_user_paths',
  {
    conversation_id: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    user_path_id: uuid('user_path_id')
      .notNull()
      .references(() => userPathsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  // Changed from object to array format
  (table) => [
    primaryKey({ columns: [table.conversation_id, table.user_path_id] }),
  ]
);

// --- Relations (remain the same) ---

export const usersRelations = relations(usersTable, ({ many }) => ({
  conversations: many(conversationsTable),
  userPaths: many(userPathsTable),
  pathFeedbacks: many(pathFeedbackTable),
  usersToUsersMatches: many(usersToUsersMatchesTable),
}));

export const conversationsRelations = relations(
  conversationsTable,
  ({ one, many }) => ({
    user: one(usersTable, {
      fields: [conversationsTable.user_id],
      references: [usersTable.id],
    }),
    conversationsToSerendipitousPaths: many(
      conversationsToSerendipitousPathsTable
    ),
    conversationsToUserPaths: many(conversationsToUserPathsTable),
  })
);

export const usersMatchesRelations = relations(
  usersMatchesTable,
  ({ many }) => ({
    usersToUsersMatches: many(usersToUsersMatchesTable),
    serendipitousPaths: many(serendipitousPathsTable),
  })
);

export const serendipitousPathsRelations = relations(
  serendipitousPathsTable,
  ({ one, many }) => ({
    usersMatch: one(usersMatchesTable, {
      fields: [serendipitousPathsTable.users_match_id],
      references: [usersMatchesTable.id],
    }),
    userPaths: many(userPathsTable),
    pathFeedbacks: many(pathFeedbackTable),
    conversationsToSerendipitousPaths: many(
      conversationsToSerendipitousPathsTable
    ),
  })
);

export const userPathsRelations = relations(
  userPathsTable,
  ({ one, many }) => ({
    user: one(usersTable, {
      fields: [userPathsTable.user_id],
      references: [usersTable.id],
    }),
    path: one(serendipitousPathsTable, {
      fields: [userPathsTable.path_id],
      references: [serendipitousPathsTable.id],
    }),
    conversationsToUserPaths: many(conversationsToUserPathsTable),
  })
);

export const pathFeedbackRelations = relations(
  pathFeedbackTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [pathFeedbackTable.user_id],
      references: [usersTable.id],
    }),
    path: one(serendipitousPathsTable, {
      fields: [pathFeedbackTable.path_id],
      references: [serendipitousPathsTable.id],
    }),
  })
);

// Relations for Join Tables

export const usersToUsersMatchesRelations = relations(
  usersToUsersMatchesTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [usersToUsersMatchesTable.user_id],
      references: [usersTable.id],
    }),
    usersMatch: one(usersMatchesTable, {
      fields: [usersToUsersMatchesTable.users_match_id],
      references: [usersMatchesTable.id],
    }),
  })
);

export const conversationsToSerendipitousPathsRelations = relations(
  conversationsToSerendipitousPathsTable,
  ({ one }) => ({
    conversation: one(conversationsTable, {
      fields: [conversationsToSerendipitousPathsTable.conversation_id],
      references: [conversationsTable.id],
    }),
    serendipitousPath: one(serendipitousPathsTable, {
      fields: [conversationsToSerendipitousPathsTable.serendipitous_path_id],
      references: [serendipitousPathsTable.id],
    }),
  })
);

export const conversationsToUserPathsRelations = relations(
  conversationsToUserPathsTable,
  ({ one }) => ({
    conversation: one(conversationsTable, {
      fields: [conversationsToUserPathsTable.conversation_id],
      references: [conversationsTable.id],
    }),
    userPath: one(userPathsTable, {
      fields: [conversationsToUserPathsTable.user_path_id],
      references: [userPathsTable.id],
    }),
  })
);
