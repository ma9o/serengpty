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
        path: {
          include: {
            commonConversations: true, // Get common conversations from SerendipitousPath
          },
        },
        uniqueConversations: true, // Get user's unique conversations from UserPath
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
                name: true,
                image: true,
                country: true,
                email: true,
              },
            },
            uniqueConversations: true, // Get connected user's unique conversations
          },
        });

        if (!connectedUserPath) {
          return null;
        }

        return {
          path: {
            id: userPath.path.id,
            createdAt: userPath.path.createdAt,
            updatedAt: userPath.path.updatedAt,
            summary: userPath.path.commonSummary, // Map commonSummary to summary for frontend compatibility
            score: userPath.path.score,
          },
          connectedUser: connectedUserPath.user,
          commonConversations: userPath.path.commonConversations.map(
            (convo) => ({
              id: convo.id,
              summary: convo.uniqueSummary, // Map uniqueSummary to summary for frontend compatibility
              datetime: convo.datetime,
            })
          ),
          currentUserUniqueConversations: userPath.uniqueConversations.map(
            (convo) => ({
              id: convo.id,
              summary: convo.uniqueSummary,
              datetime: convo.datetime,
            })
          ),
          connectedUserUniqueConversations:
            connectedUserPath.uniqueConversations.map((convo) => ({
              id: convo.id,
              summary: convo.uniqueSummary,
              datetime: convo.datetime,
            })),
        };
      })
    );

    // Filter out any null results
    const filteredResults = results.filter(
      (result) => result !== null
    ) as SerendipitousPathsResponse[];
    
    // Group results by connected user to calculate average score, but keep individual paths
    const userMap = new Map<string, {
      paths: SerendipitousPathsResponse[],
      averageScore: number
    }>();
    
    for (const result of filteredResults) {
      const userId = result.connectedUser.id;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          paths: [],
          averageScore: 0
        });
      }
      userMap.get(userId)!.paths.push(result);
    }
    
    // Calculate average score for each user
    for (const userData of userMap.values()) {
      const totalScore = userData.paths.reduce((sum, path) => sum + path.path.score, 0);
      userData.averageScore = totalScore / userData.paths.length;
      
      // Add the average score to each path for this user
      userData.paths.forEach(path => {
        path.averageUserScore = userData.averageScore;
        path.totalUserPaths = userData.paths.length;
      });
    }
    
    // Create a unified list of paths, preserving all individual paths
    const processedResults: SerendipitousPathsResponse[] = [];
    for (const userData of userMap.values()) {
      processedResults.push(...userData.paths);
    }
    
    // Sort first by averageUserScore, then by individual path score
    processedResults.sort((a, b) => {
      // First sort by average user score
      if (a.averageUserScore !== b.averageUserScore) {
        return b.averageUserScore - a.averageUserScore;
      }
      // If same user, then sort by individual path score
      return b.path.score - a.path.score;
    });

    return processedResults;
  } catch (error) {
    console.error('Error fetching serendipitous paths:', error);
    throw error;
  }
}
