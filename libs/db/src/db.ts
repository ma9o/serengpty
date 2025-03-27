import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const db = drizzle({
  connection: {
    connectionString: process.env['DATABASE_URL'],
    ssl: process.env['NODE_ENV'] === 'production',
  },
  schema: schema,
});
