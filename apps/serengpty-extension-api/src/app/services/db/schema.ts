import { relations } from 'drizzle-orm';
import {
  pgTable,
  timestamp,
  text,
  varchar,
  uuid,
  index,
  halfvec,
} from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),

  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const conversationsTable = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    title: varchar({ length: 255 }).notNull(),
    content: text().notNull(),
    embedding: halfvec({ dimensions: 3072 }).notNull(),

    userId: uuid().references(() => usersTable.id),

    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index('embeddingIndex').using(
      'hnsw',
      table.embedding.op('halfvec_cosine_ops')
    ),
  ]
);

export const usersRelations = relations(usersTable, ({ many }) => ({
  conversations: many(conversationsTable),
}));

export const conversationsRelations = relations(
  conversationsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [conversationsTable.userId],
      references: [usersTable.id],
    }),
  })
);
