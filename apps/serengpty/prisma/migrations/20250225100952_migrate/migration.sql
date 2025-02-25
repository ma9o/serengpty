-- AlterTable
ALTER TABLE "ApiKey" ALTER COLUMN "key" SET DEFAULT encode(sha256(random()::text::bytea), 'hex');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "email" DROP NOT NULL;
