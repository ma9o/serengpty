'use server';

import { and, exists, count, eq, asc, desc, inArray } from 'drizzle-orm';
import {
  db,
  usersToUsersMatchesTable,
  usersMatchesTable,
  usersTable,
  serendipitousPathsTable,
  pathFeedbackTable,
} from '@enclaveid/db';
import { auth } from '../services/auth';

export async function markUserMatchAsViewed(matchId: string) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    await db
      .update(usersMatchesTable)
      .set({ viewed: true })
      .where(eq(usersMatchesTable.id, matchId));

    return { success: true };
  } catch (error) {
    console.error('Error marking match as viewed:', error);
    throw error;
  }
}

export async function getUnviewedMatchesCount() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    const currentUserId = session.user.id;

    const countResult = await db
      .select({ count: count() })
      .from(usersMatchesTable)
      .where(
        and(
          exists(
            db
              .select()
              .from(usersToUsersMatchesTable) // Assuming you have a join table named 'users_users_match' for the many-to-many relation between users and usersMatch
              .where(
                and(
                  eq(
                    usersToUsersMatchesTable.usersMatchId,
                    usersMatchesTable.id
                  ), // Join condition on usersMatch ID
                  eq(usersToUsersMatchesTable.userId, currentUserId) // Filter for current user ID in the join table
                )
              )
          ),
          eq(usersMatchesTable.viewed, false) // Original 'viewed: false' condition
        )
      )
      .execute();

    return countResult[0].count;
  } catch (error) {
    console.error('Error fetching unviewed matches count:', error);
    throw error;
  }
}

export async function getSerendipitousPaths() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    const currentUserId = session.user.id;

    // Get the current user's sensitiveMatching preference
    const currentUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, currentUserId),
      columns: {
        sensitiveMatching: true,
      },
    });

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Get all user matches with associated users to check their sensitiveMatching settings
    const userMatchIdsSubquery = db
      .select({ matchId: usersMatchesTable.id }) // Select the foreign key pointing to usersMatchTable
      .from(usersToUsersMatchesTable)
      .where(eq(usersToUsersMatchesTable.userId, currentUserId)); // Find entries for the current user

    const userMatches = await db.query.usersMatchesTable.findMany({
      // --- Translate `orderBy` ---
      orderBy: desc(usersMatchesTable.score),

      // --- Translate `where` (using the subquery) ---
      where: inArray(usersMatchesTable.id, userMatchIdsSubquery), // Filter matches based on the subquery results

      // --- Translate `select` (top-level) ---
      columns: {
        id: true,
        score: true,
        viewed: true,
      },

      // --- Translate nested `select`s using `with` ---
      with: {
        // --- users relation ---
        usersToUsersMatches: {
          with: {
            user: {
              // Relation name defined in usersMatchTable schema
              columns: {
                id: true,
                name: true,
                country: true,
                sensitiveMatching: true,
              },
            },
          },
        },

        // --- serendipitousPaths relation ---
        serendipitousPaths: {
          // Relation name defined in usersMatchTable schema
          orderBy: [
            // asc(serendipitousPathsTable.category), // Uncomment if needed
            asc(serendipitousPathsTable.balanceScore),
          ],
          columns: {
            id: true,
            title: true,
            commonSummary: true,
            isSensitive: true,
            category: true,
          },
          with: {
            // --- commonConversations relation ---
            conversationsToSerendipitousPaths: {
              // Relation name defined in serendipitousPathsTable schema
              with: {
                conversation: {
                  columns: {
                    id: true,
                    title: true,
                    summary: true,
                    datetime: true,
                  },
                  with: {
                    user: {
                      // Relation name defined in commonConversationsTable schema
                      columns: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },

            // --- userPaths relation ---
            userPaths: {
              // Relation name defined in serendipitousPathsTable schema
              columns: {
                // Select columns directly from userPathsTable
                uniqueCallToAction: true,
                uniqueSummary: true,
                // id: true, // Add if needed, wasn't in original prisma select for userPaths itself
              },
              with: {
                user: {
                  // Relation name defined in userPathsTable schema
                  columns: {
                    id: true,
                    name: true,
                    country: true,
                  },
                },
                conversationsToUserPaths: {
                  with: {
                    conversation: {
                      columns: {
                        id: true,
                        title: true,
                        summary: true,
                        datetime: true,
                      },
                    },
                  },
                },
              },
            },

            // --- feedback relation ---
            pathFeedbacks: {
              // Relation name defined in serendipitousPathsTable schema
              // Filter related feedback records directly
              where: eq(pathFeedbackTable.userId, currentUserId),
              columns: {
                id: true,
                score: true,
              },
              // No 'with' needed here as per original query
            },
          },
        },
      },
    });

    // Process each match to filter sensitive paths based on both users' sensitiveMatching settings
    return userMatches.map((match) => {
      // Split users into current user and matched user
      const otherUsers = match.usersToUsersMatches.filter(
        (u2u) => u2u.user.id !== currentUserId
      );

      // Only include sensitive paths if both users have sensitiveMatching enabled
      const filteredPaths = match.serendipitousPaths.filter((path) => {
        if (!path.isSensitive) {
          // Always include non-sensitive paths
          return true;
        }

        // For sensitive paths, check if all users have sensitiveMatching enabled
        const allUsersHaveSensitiveMatchingEnabled = otherUsers.every(
          (u2u) => u2u.user.sensitiveMatching
        );

        return allUsersHaveSensitiveMatchingEnabled;
      });

      return {
        id: match.id,
        score: match.score,
        viewed: match.viewed,
        users: otherUsers.map((u2u) => ({
          id: u2u.user.id,
          name: u2u.user.name,
          country: u2u.user.country,
        })),
        serendipitousPaths: filteredPaths.map((path) => ({
          ...path,
          feedback: path.pathFeedbacks, // Include feedback in the response
        })),
      };
    });
  } catch (error) {
    console.error('Error fetching serendipitous paths:', error);
    throw error;
  }
}

export async function setPathFeedback(pathId: string, score: 1 | -1 | 0) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    const userId = session.user.id;

    // Check if user has already given feedback to this path
    const existingFeedback = await db.query.pathFeedbackTable.findFirst({
      where: and(
        eq(pathFeedbackTable.userId, userId),
        eq(pathFeedbackTable.pathId, pathId)
      ),
    });

    if (existingFeedback) {
      // Update existing feedback
      return await db
        .update(pathFeedbackTable)
        .set({ score })
        .where(eq(pathFeedbackTable.id, existingFeedback.id));
    } else {
      // Create new feedback
      return await db.insert(pathFeedbackTable).values({
        score,
        userId,
        pathId,
      });
    }
  } catch (error) {
    console.error('Error setting path feedback:', error);
    throw error;
  }
}
