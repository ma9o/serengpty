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
  createdAt: timestamp('created_at', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { precision: 3, mode: 'date' })
    .notNull()
    .$onUpdate(() => new Date()),

  name: text('name').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  country: text('country').default('INTERNET').notNull(),
  sensitiveMatching: boolean('sensitive_matching').default(false).notNull(),

  extensionApiKey: varchar('extension_api_key', { length: 32 })
    .notNull()
    .default(sql`replace(gen_random_uuid()::text, '-', '')`),

  // For auth.js although unused
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const conversationsTable = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { precision: 3, mode: 'date' })
      .notNull()
      .$onUpdate(() => new Date()),

    title: text('title'), // Optional
    summary: text('summary'), // Optional
    content: text('content'), // Added, Optional
    datetime: timestamp('datetime', { precision: 3, mode: 'date' }), // Optional

    embedding: halfvec('embedding', { dimensions: 3072 }), // Optional, pgvector type

    userId: uuid('user_id').references(() => usersTable.id, {
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
    index('conversation_user_id_idx').on(table.userId),
  ]
);

export const usersMatchesTable = pgTable('users_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { precision: 3, mode: 'date' })
    .notNull()
    .$onUpdate(() => new Date()),

  score: doublePrecision('score').notNull(),
  viewed: boolean('viewed').default(false).notNull(),
});

export const serendipitousPathsTable = pgTable('serendipitous_paths', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { precision: 3, mode: 'date' })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { precision: 3, mode: 'date' })
    .notNull()
    .$onUpdate(() => new Date()),

  title: text('title').notNull(),
  commonSummary: text('common_summary').notNull(),
  category: text('category').notNull(),
  balanceScore: doublePrecision('balance_score').notNull(),
  isSensitive: boolean('is_sensitive').default(false).notNull(),

  usersMatchId: uuid('users_match_id')
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
    createdAt: timestamp('created_at', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { precision: 3, mode: 'date' })
      .notNull()
      .$onUpdate(() => new Date()),

    uniqueSummary: text('unique_summary').notNull(),
    uniqueCallToAction: text('unique_call_to_action').notNull(),

    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    pathId: uuid('path_id')
      .notNull()
      .references(() => serendipitousPathsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  // Changed from object to array format
  (table) => [
    unique('user_paths_user_id_path_id_key').on(table.userId, table.pathId),
  ]
);

export const pathFeedbackTable = pgTable(
  'path_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { precision: 3, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { precision: 3, mode: 'date' })
      .notNull()
      .$onUpdate(() => new Date()),

    score: integer('score').notNull(), // -1, 0, or 1

    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    pathId: uuid('path_id')
      .notNull()
      .references(() => serendipitousPathsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  // Changed from object to array format
  (table) => [
    unique('path_feedback_user_id_path_id_key').on(table.userId, table.pathId),
  ]
);

// --- Join Tables ---

export const usersToUsersMatchesTable = pgTable(
  'users_to_users_matches',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    usersMatchId: uuid('users_match_id')
      .notNull()
      .references(() => usersMatchesTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  // Changed from object to array format (though primaryKey isn't strictly affected by the deprecation notice, using array for consistency)
  (table) => [primaryKey({ columns: [table.userId, table.usersMatchId] })]
);

// This corresponds to the original commonConversations relation
export const conversationsToSerendipitousPathsTable = pgTable(
  'conversations_to_serendipitous_paths',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    serendipitousPathId: uuid('serendipitous_path_id')
      .notNull()
      .references(() => serendipitousPathsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  // Changed from object to array format
  (table) => [
    primaryKey({
      columns: [table.conversationId, table.serendipitousPathId],
    }),
  ]
);

// This corresponds to the original uniqueConversations relation
export const conversationsToUserPathsTable = pgTable(
  'conversations_to_user_paths',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    userPathId: uuid('user_path_id')
      .notNull()
      .references(() => userPathsTable.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  // Changed from object to array format
  (table) => [primaryKey({ columns: [table.conversationId, table.userPathId] })]
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
      fields: [conversationsTable.userId],
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
      fields: [serendipitousPathsTable.usersMatchId],
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
      fields: [userPathsTable.userId],
      references: [usersTable.id],
    }),
    path: one(serendipitousPathsTable, {
      fields: [userPathsTable.pathId],
      references: [serendipitousPathsTable.id],
    }),
    conversationsToUserPaths: many(conversationsToUserPathsTable),
  })
);

export const pathFeedbackRelations = relations(
  pathFeedbackTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [pathFeedbackTable.userId],
      references: [usersTable.id],
    }),
    path: one(serendipitousPathsTable, {
      fields: [pathFeedbackTable.pathId],
      references: [serendipitousPathsTable.id],
    }),
  })
);

// Relations for Join Tables

export const usersToUsersMatchesRelations = relations(
  usersToUsersMatchesTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [usersToUsersMatchesTable.userId],
      references: [usersTable.id],
    }),
    usersMatch: one(usersMatchesTable, {
      fields: [usersToUsersMatchesTable.usersMatchId],
      references: [usersMatchesTable.id],
    }),
  })
);

export const conversationsToSerendipitousPathsRelations = relations(
  conversationsToSerendipitousPathsTable,
  ({ one }) => ({
    conversation: one(conversationsTable, {
      fields: [conversationsToSerendipitousPathsTable.conversationId],
      references: [conversationsTable.id],
    }),
    serendipitousPath: one(serendipitousPathsTable, {
      fields: [conversationsToSerendipitousPathsTable.serendipitousPathId],
      references: [serendipitousPathsTable.id],
    }),
  })
);

export const conversationsToUserPathsRelations = relations(
  conversationsToUserPathsTable,
  ({ one }) => ({
    conversation: one(conversationsTable, {
      fields: [conversationsToUserPathsTable.conversationId],
      references: [conversationsTable.id],
    }),
    userPath: one(userPathsTable, {
      fields: [conversationsToUserPathsTable.userPathId],
      references: [userPathsTable.id],
    }),
  })
);
