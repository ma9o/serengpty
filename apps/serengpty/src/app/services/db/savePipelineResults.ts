import { prisma } from './prisma';

export interface ConversationPairClusterRow {
  user_id: string;
  match_group_id: number;
  conversation_id: string;
  title: string;
  summary: string;
  start_date: string;
  start_time: string;
  cluster_id: number;
}

export interface UserSimilaritiesRow {
  user_id: string;
  similarity: number;
}

export interface SerendipityOptimizedRow {
  user1_id: string;
  user2_id: string;
  path_id: string;
  path_title: string;
  path_description: string;
  user1_unique_branches: string;
  user2_unique_branches: string;
  user1_call_to_action: string;
  user2_call_to_action: string;
  row_idx: number;
  match_group_id: number;
  category: string;
  common_conversation_ids: string[];
  user1_conversation_ids: string[];
  user2_conversation_ids: string[];
}

export async function savePipelineResults(
  currentUserId: string,
  serendipityOptimized: SerendipityOptimizedRow[],
  userSimilarities: UserSimilaritiesRow[],
  conversationPairClusters: ConversationPairClusterRow[]
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // Step 1: Update existing conversations with details from conversationPairClusters
      for (const row of conversationPairClusters) {
        await tx.conversation.update({
          where: { id: row.conversation_id },
          data: {
            title: row.title,
            summary: row.summary,
            datetime: new Date(`${row.start_date}T${row.start_time}`),
          },
        });
      }

      // Step 2: Create UsersMatch records based on userSimilarities
      for (const row of userSimilarities) {
        await tx.usersMatch.create({
          data: {
            score: row.similarity,
            users: {
              connect: [{ id: currentUserId }, { id: row.user_id }],
            },
          },
        });
      }

      // Step 3: Process serendipityOptimized to create paths and associate conversations
      for (const row of serendipityOptimized) {
        const user1Id = row.user1_id;
        const user2Id = row.user2_id;

        // Find the UsersMatch record for this pair of users
        const usersMatch = await tx.usersMatch.findFirst({
          where: {
            AND: [
              { users: { some: { id: user1Id } } },
              { users: { some: { id: user2Id } } },
              { users: { none: { id: { notIn: [user1Id, user2Id] } } } },
            ],
          },
        });

        if (!usersMatch) {
          throw new Error(
            `UsersMatch not found for users ${user1Id} and ${user2Id}`
          );
        }

        // Create a SerendipitousPath record
        const path = await tx.serendipitousPath.create({
          data: {
            title: row.path_title,
            commonSummary: row.path_description,
            category: row.category,
            order: row.row_idx,
            usersMatch: {
              connect: { id: usersMatch.id },
            },
          },
        });

        // Associate common conversations with the SerendipitousPath
        await tx.conversation.updateMany({
          where: {
            id: { in: row.common_conversation_ids },
          },
          data: {
            serendipitousPathId: path.id,
            userPathId: null, // Clear any previous UserPath association
          },
        });

        // Create UserPath for user1 and associate unique conversations
        const user1Path = await tx.userPath.create({
          data: {
            uniqueSummary: row.user1_unique_branches,
            uniqueCallToAction: row.user1_call_to_action,
            user: { connect: { id: user1Id } },
            path: { connect: { id: path.id } },
          },
        });

        await tx.conversation.updateMany({
          where: {
            id: { in: row.user1_conversation_ids },
            userId: user1Id,
          },
          data: {
            userPathId: user1Path.id,
            serendipitousPathId: null, // Clear any previous SerendipitousPath association
          },
        });

        // Create UserPath for user2 and associate unique conversations
        const user2Path = await tx.userPath.create({
          data: {
            uniqueSummary: row.user2_unique_branches,
            uniqueCallToAction: row.user2_call_to_action,
            user: { connect: { id: user2Id } },
            path: { connect: { id: path.id } },
          },
        });

        await tx.conversation.updateMany({
          where: {
            id: { in: row.user2_conversation_ids },
            userId: user2Id,
          },
          data: {
            userPathId: user2Path.id,
            serendipitousPathId: null, // Clear any previous SerendipitousPath association
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error saving dataframes:', {
        message: error.message,
        stack: error.stack,
      });
    }
    throw error;
  }
}
