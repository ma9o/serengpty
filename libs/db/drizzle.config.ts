import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const dbUrl = new URL(process.env.DATABASE_URL!);

export default defineConfig({
  out: './drizzle',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    ssl: true,
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port),
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1),
  },
});
