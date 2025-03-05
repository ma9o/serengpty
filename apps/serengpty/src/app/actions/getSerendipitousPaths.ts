'use server';

import { auth } from '../services/auth';
import { prisma } from '../services/db/prisma';

export async function getSerendipitousPaths() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    const currentUserId = session.user.id;

    // This query fetches all user matches for the current user along with associated serendipitous paths
    return await prisma.usersMatch.findMany({
      // Find all UsersMatch records that include the current user
      where: {
        users: {
          some: {
            id: currentUserId,
          },
        },
      },
      select: {
        score: true, // Similarity score between users
        // Include other users in the match, but exclude the current user
        users: {
          select: {
            id: true,
            name: true,
            country: true,
          },
          where: {
            id: {
              not: currentUserId,
            },
          },
        },
        // Include all serendipitous paths associated with this user match
        serendipitousPaths: {
          select: {
            id: true,
            title: true,
            commonSummary: true, // Summary of conversations common to both users
            // Include common conversations for this serendipitous path
            commonConversations: {
              select: {
                id: true,
                summary: true,
                datetime: true,
              },
            },
            // Include user-specific paths containing unique conversations
            userPaths: {
              select: {
                // Include user information for each path
                user: {
                  select: {
                    id: true,
                    name: true,
                    country: true,
                  },
                },
                // Include conversations unique to this specific user path
                uniqueConversations: {
                  select: {
                    id: true,
                    summary: true,
                    datetime: true,
                  },
                },
                // Include the call to action for this specific user path
                uniqueCallToAction: true,
                // Include the summary for this specific user path
                uniqueSummary: true,
              },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching serendipitous paths:', error);
    throw error;
  }
}
