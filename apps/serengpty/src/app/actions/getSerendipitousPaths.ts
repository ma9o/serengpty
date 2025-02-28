'use server';

import { auth } from '../services/auth';
import { prisma } from '../services/db/prisma';
import { type SerendipitousPathsResponse } from '../types/serendipitous-paths';

export async function getSerendipitousPaths(): Promise<
  SerendipitousPathsResponse[]
> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    const currentUserId = session.user.id;

    // Find all serendipitous paths for the current user
    const userPaths = await prisma.userPath.findMany({
      where: {
        userId: currentUserId,
      },
      include: {
        path: true,
        commonConversations: true,
        uniqueConversations: true,
      },
    });

    // For each path, find the connected user
    const results = await Promise.all(
      userPaths.map(async (userPath) => {
        // Find the other user connected to this path
        const connectedUserPath = await prisma.userPath.findFirst({
          where: {
            pathId: userPath.pathId,
            userId: { not: currentUserId },
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                image: true,
                country: true,
                email: true,
              },
            },
            uniqueConversations: true,
          },
        });

        if (!connectedUserPath) {
          return null;
        }

        return {
          path: userPath.path,
          connectedUser: connectedUserPath.user,
          commonConversations: userPath.commonConversations,
          currentUserUniqueConversations: userPath.uniqueConversations,
          connectedUserUniqueConversations:
            connectedUserPath.uniqueConversations,
        };
      })
    );

    // Filter out any null results
    const filteredResults = results.filter(
      (result) => result !== null
    ) as SerendipitousPathsResponse[];

    return filteredResults;
  } catch (error) {
    console.error('Error fetching serendipitous paths:', error);
    throw error;
  }
}
