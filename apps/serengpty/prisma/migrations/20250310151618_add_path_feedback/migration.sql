-- CreateTable
CREATE TABLE "PathFeedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,

    CONSTRAINT "PathFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PathFeedback_userId_pathId_key" ON "PathFeedback"("userId", "pathId");

-- AddForeignKey
ALTER TABLE "PathFeedback" ADD CONSTRAINT "PathFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathFeedback" ADD CONSTRAINT "PathFeedback_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "SerendipitousPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
