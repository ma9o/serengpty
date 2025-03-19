import { relations, sql } from 'drizzle-orm';
import {
  integer,
  pgTable,
  timestamp,
  text,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  name: varchar({ length: 255 }).notNull(),
  passwordHash: varchar({ length: 255 }).notNull(),

  apiToken: varchar({ length: 255 }).notNull().unique(),
  apiTokenExpiresAt: timestamp()
    .notNull()
    .default(sql`NOW() + INTERVAL '30 days'`),

  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const conversationsTable = pgTable('conversations', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  title: varchar({ length: 255 }).notNull(),
  content: text().notNull(),
  embedding: vector({ dimensions: 3072 }).notNull(),

  userId: integer().references(() => usersTable.id),

  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

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
