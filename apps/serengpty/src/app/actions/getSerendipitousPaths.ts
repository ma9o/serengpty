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

    return await prisma.usersMatch.findMany({
      where: {
        users: {
          some: {
            id: currentUserId,
          },
        },
      },
      include: {
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
        serendipitousPaths: {
          select: {
            id: true,
            title: true,
            commonSummary: true,
            commonConversations: {
              select: {
                id: true,
                summary: true,
                datetime: true,
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
                    summary: true,
                    datetime: true,
                  },
                },
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
