// Environment variables
export const env = {
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',

  // Next auth.js
  AUTH_SECRET: process.env.AUTH_SECRET,

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // Storage
  AZURE_STORAGE_ACCOUNT_NAME: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  AZURE_STORAGE_ACCOUNT_KEY: process.env.AZURE_STORAGE_ACCOUNT_KEY,

  // Stream Chat
  STREAM_CHAT_API_SECRET: process.env.STREAM_CHAT_API_SECRET,
  NEXT_PUBLIC_STREAM_CHAT_API_KEY: process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY,

  // Pipeline
  PIPELINE_SECRET: process.env.PIPELINE_SECRET,
};
