import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: process.env['NODE_ENV'] === 'production',
});

export const db = drizzle({
  client: pool,
  schema: schema,
});
