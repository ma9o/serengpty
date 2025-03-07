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
  is_highly_sensitive: boolean;
  balance_score: number;
}

export async function savePipelineResults(
  currentUserId: string,
  serendipityOptimized: SerendipityOptimizedRow[],
  userSimilarities: UserSimilaritiesRow[],
  conversationPairClusters: ConversationPairClusterRow[]
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // **Step 1: Bulk Create Conversations**
      const conversationData = conversationPairClusters.map((row) => ({
        id: row.conversation_id,
        title: row.title || 'No title',
        summary: row.summary || 'No summary',
        datetime: new Date(`${row.start_date} ${row.start_time}`),
        userId: row.user_id,
      }));

      await tx.conversation.createMany({
        data: conversationData,
        skipDuplicates: true, // Skips if `id` already exists
      });

      // **Step 2: Group SerendipityOptimized by match_group_id**
      const matchGroups: { [key: number]: SerendipityOptimizedRow[] } = {};
      for (const row of serendipityOptimized) {
        const groupId = row.match_group_id;
        if (!matchGroups[groupId]) matchGroups[groupId] = [];
        matchGroups[groupId].push(row);
      }

      // **Step 3: Prepare and Create UsersMatch Records**
      const usersMatchData = Object.entries(matchGroups).map(
        ([groupId, rows]) => {
          const user1Id = rows[0].user1_id;
          const user2Id = rows[0].user2_id;
          let otherUserId: string;
          if (user1Id === currentUserId) otherUserId = user2Id;
          else if (user2Id === currentUserId) otherUserId = user1Id;
          else
            throw new Error(
              `Neither user1_id nor user2_id matches currentUserId for match_group_id ${groupId}`
            );

          const similarityRow = userSimilarities.find(
            (u) => u.user_id === otherUserId
          );
          if (!similarityRow)
            throw new Error(`Similarity not found for user ${otherUserId}`);

          return {
            score: similarityRow.similarity,
            users: { connect: [{ id: user1Id }, { id: user2Id }] },
          };
        }
      );

      const existingUsersMatches = await tx.usersMatch.findMany({
        where: {
          users: {
            some: {
              id: currentUserId,
            },
          },
        },
        include: {
          users: true,
        },
      });

      // Update existing users matches or create new ones
      const createdUsersMatches = await Promise.all(
        usersMatchData.map((data) => {
          const existingUsersMatch = existingUsersMatches.find((match) =>
            match.users.every((user) =>
              data.users.connect.some((u) => u.id === user.id)
            )
          );

          if (existingUsersMatch) {
            return tx.usersMatch.update({
              where: { id: existingUsersMatch.id },
              data: {
                score: data.score,
              },
            });
          } else {
            return tx.usersMatch.create({
              data,
            });
          }
        })
      );

      // **Step 4: Prepare SerendipitousPath and UserPath Data**
      const pathData = [];
      for (const [idx, rows] of Object.entries(matchGroups)) {
        const usersMatchId = createdUsersMatches[Number(idx)].id;
        for (const row of rows) {
          pathData.push({
            id: row.path_id,
            title: row.path_title,
            commonSummary: row.path_description,
            category: row.category,
            balanceScore: row.balance_score,
            isSensitive: row.is_highly_sensitive,
            usersMatchId,
            commonConversations: {
              connect: row.common_conversation_ids.map((id) => ({ id })),
            },
          });
        }
      }

      const userPathData = [];
      for (const rows of Object.values(matchGroups)) {
        for (const row of rows) {
          userPathData.push(
            {
              userId: row.user1_id,
              pathId: row.path_id,
              uniqueSummary: row.user1_unique_branches,
              uniqueCallToAction: row.user1_call_to_action,
              uniqueConversations: {
                connect: row.user1_conversation_ids.map((id) => ({ id })),
              },
            },
            {
              userId: row.user2_id,
              pathId: row.path_id,
              uniqueSummary: row.user2_unique_branches,
              uniqueCallToAction: row.user2_call_to_action,
              uniqueConversations: {
                connect: row.user2_conversation_ids.map((id) => ({ id })),
              },
            }
          );
        }
      }

      // **Step 5: Upsert SerendipitousPath Records**
      await Promise.all(
        pathData.map((path) =>
          tx.serendipitousPath.upsert({
            where: { id: path.id },
            create: path,
            update: {
              title: path.title,
              commonSummary: path.commonSummary,
              category: path.category,
              balanceScore: path.balanceScore,
              isSensitive: path.isSensitive,
              usersMatchId: path.usersMatchId,
              commonConversations: { set: path.commonConversations.connect },
            },
          })
        )
      );

      // **Step 6: Upsert UserPath Records**
      await Promise.all(
        userPathData.map((up) =>
          tx.userPath.upsert({
            where: { userId_pathId: { userId: up.userId, pathId: up.pathId } },
            create: up,
            update: {
              uniqueSummary: up.uniqueSummary,
              uniqueCallToAction: up.uniqueCallToAction,
              uniqueConversations: { set: up.uniqueConversations.connect },
            },
          })
        )
      );
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
