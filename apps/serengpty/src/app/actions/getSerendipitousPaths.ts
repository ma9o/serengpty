'use server';

import { auth } from '../services/auth';
import { prisma } from '../services/db/prisma';

export async function markUserMatchAsViewed(matchId: string) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    await prisma.usersMatch.update({
      where: { id: matchId },
      data: { viewed: true },
    });

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

    const count = await prisma.usersMatch.count({
      where: {
        users: {
          some: {
            id: currentUserId,
          },
        },
        viewed: false,
      },
    });

    return count;
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
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { sensitiveMatching: true },
    });

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Get all user matches with associated users to check their sensitiveMatching settings
    const userMatches = await prisma.usersMatch.findMany({
      orderBy: {
        score: 'desc',
      },
      where: {
        users: {
          some: {
            id: currentUserId,
          },
        },
      },
      select: {
        id: true,
        score: true,
        viewed: true,
        users: {
          select: {
            id: true,
            name: true,
            country: true,
            sensitiveMatching: true,
          },
        },
        serendipitousPaths: {
          orderBy: [{ category: 'asc' }, { balanceScore: 'asc' }],
          select: {
            id: true,
            title: true,
            commonSummary: true,
            isSensitive: true,
            commonConversations: {
              select: {
                id: true,
                title: true,
                summary: true,
                datetime: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            userPaths: {
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    country: true,
                  },
                },
                uniqueConversations: {
                  select: {
                    id: true,
                    title: true,
                    summary: true,
                    datetime: true,
                  },
                },
                uniqueCallToAction: true,
                uniqueSummary: true,
              },
            },
            feedback: {
              where: {
                userId: currentUserId,
              },
              select: {
                id: true,
                score: true,
              },
            },
          },
        },
      },
    });

    // Process each match to filter sensitive paths based on both users' sensitiveMatching settings
    return userMatches.map((match) => {
      // Split users into current user and matched user
      const otherUsers = match.users.filter(
        (user) => user.id !== currentUserId
      );

      // Only include sensitive paths if both users have sensitiveMatching enabled
      const filteredPaths = match.serendipitousPaths.filter((path) => {
        if (!path.isSensitive) {
          // Always include non-sensitive paths
          return true;
        }

        // For sensitive paths, check if all users have sensitiveMatching enabled
        const allUsersHaveSensitiveMatchingEnabled = match.users.every(
          (user) => user.sensitiveMatching
        );

        return allUsersHaveSensitiveMatchingEnabled;
      });

      return {
        id: match.id,
        score: match.score,
        viewed: match.viewed,
        users: otherUsers.map((user) => ({
          id: user.id,
          name: user.name,
          country: user.country,
        })),
        serendipitousPaths: filteredPaths.map((path) => ({
          ...path,
          feedback: path.feedback, // Include feedback in the response
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
    const existingFeedback = await prisma.pathFeedback.findUnique({
      where: {
        userId_pathId: {
          userId,
          pathId,
        },
      },
    });

    if (existingFeedback) {
      // Update existing feedback
      return await prisma.pathFeedback.update({
        where: { id: existingFeedback.id },
        data: { score },
      });
    } else {
      // Create new feedback
      return await prisma.pathFeedback.create({
        data: {
          score,
          user: { connect: { id: userId } },
          path: { connect: { id: pathId } },
        },
      });
    }
  } catch (error) {
    console.error('Error setting path feedback:', error);
    throw error;
  }
}
