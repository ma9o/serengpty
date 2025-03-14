import { getPrismaClient } from './prisma';

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
  is_sensitive: boolean;
  balance_score: number;
}

export async function savePipelineResults(
  currentUserId: string,
  serendipityOptimized: SerendipityOptimizedRow[],
  userSimilarities: UserSimilaritiesRow[],
  conversationPairClusters: ConversationPairClusterRow[]
): Promise<void> {
  // Filter invalid rows
  serendipityOptimized = serendipityOptimized.filter(
    (row) =>
      row.common_conversation_ids.length > 0 &&
      row.user1_conversation_ids.length > 0 &&
      row.user2_conversation_ids.length > 0 &&
      row.user1_id &&
      row.user2_id
  );

  try {
    await getPrismaClient()!.$transaction(async (tx) => {
      // Declare variables at the transaction scope level
      let conversationData: any[] = [];
      const matchGroups: { [key: number]: SerendipityOptimizedRow[] } = {};
      let usersMatchData: any[] = [];
      let existingUsersMatches: any[] = [];
      let createdUsersMatches: any[] = [];
      const pathData: any[] = [];
      const userPathData: any[] = [];

      // **Step 1: Bulk Create Conversations**
      try {
        conversationData = conversationPairClusters.map((row) => ({
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
      } catch (error) {
        throw new Error(
          `Failed to create conversations: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // **Step 2 & 3: Group and Create UsersMatch Records**
      try {
        // **Step 2: Group SerendipityOptimized by match_group_id**
        for (const row of serendipityOptimized) {
          const groupId = row.match_group_id;
          if (!matchGroups[groupId]) matchGroups[groupId] = [];
          matchGroups[groupId].push(row);
        }

        // **Step 3: Prepare and Create UsersMatch Records**
        usersMatchData = Object.entries(matchGroups).map(([groupId, rows]) => {
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
        });

        existingUsersMatches = await tx.usersMatch.findMany({
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
        createdUsersMatches = await Promise.all(
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
                include: {
                  users: true,
                },
              });
            } else {
              return tx.usersMatch.create({
                data,
                include: {
                  users: true,
                },
              });
            }
          })
        );
      } catch (error) {
        throw new Error(
          `Failed to process user matches: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // **Step 4, 5 & 6: Prepare and Upsert Paths and UserPaths**
      try {
        // Create a map to match match_group_id to its corresponding usersMatch record
        const matchGroupToUsersMatchMap = new Map();

        // Fill the map based on the user IDs in each match group and created users match
        Object.entries(matchGroups).forEach(([groupId, rows]) => {
          const user1Id = rows[0].user1_id;
          const user2Id = rows[0].user2_id;

          const matchingUsersMatch = createdUsersMatches.find(
            (match) =>
              match.users?.some((u) => u.id === user1Id) &&
              match.users?.some((u) => u.id === user2Id)
          );

          if (matchingUsersMatch) {
            matchGroupToUsersMatchMap.set(
              Number(groupId),
              matchingUsersMatch.id
            );
          }
        });

        // **Step 4: Prepare SerendipitousPath and UserPath Data**
        for (const [groupId, rows] of Object.entries(matchGroups)) {
          const usersMatchId = matchGroupToUsersMatchMap.get(Number(groupId));
          if (!usersMatchId) {
            throw new Error(
              `Could not find usersMatchId for match_group_id ${groupId} in ${JSON.stringify(
                matchGroupToUsersMatchMap
              )}`
            );
          }

          for (const row of rows) {
            pathData.push({
              id: row.path_id,
              title: row.path_title,
              commonSummary: row.path_description,
              category: row.category,
              balanceScore: row.balance_score,
              isSensitive: row.is_sensitive,
              usersMatchId,
              commonConversations: {
                connect: row.common_conversation_ids.map((id) => ({ id })),
              },
            });
          }
        }

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
              where: {
                userId_pathId: { userId: up.userId, pathId: up.pathId },
              },
              create: up,
              update: {
                uniqueSummary: up.uniqueSummary,
                uniqueCallToAction: up.uniqueCallToAction,
                uniqueConversations: { set: up.uniqueConversations.connect },
              },
            })
          )
        );
      } catch (error) {
        throw new Error(
          `Failed to process paths and user paths: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
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
