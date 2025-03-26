-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "embedding" halfvec(3072);
