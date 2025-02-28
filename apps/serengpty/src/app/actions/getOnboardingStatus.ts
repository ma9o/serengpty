'use server';

import { prisma } from '../services/db/prisma';
import { getCurrentUser } from './getCurrentUser';

// Queue duration in minutes - estimated time for processing a single user
const USER_PROCESSING_TIME_MINUTES = 10;

/**
 * Gets the queue position and estimated completion time for the current user.
 * Used in the onboarding page to display processing status.
 */
export async function getOnboardingStatus(): Promise<{
  queuePosition: number;
  estimatedTimeSeconds: number;
  success: boolean;
  message?: string;
}> {
  try {
    // Get current user from session
    const user = await getCurrentUser();
    if (!user) {
      return {
        queuePosition: 0,
        estimatedTimeSeconds: 0,
        success: false,
        message: 'You must be logged in to check your onboarding status.',
      };
    }

    const userId = user.id;

    // Check if user already has userPaths
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { userPaths: true },
    });

    if (!currentUser) {
      return {
        queuePosition: 0,
        estimatedTimeSeconds: 0,
        success: false,
        message: 'User not found.',
      };
    }

    // If user already has paths, they're not in the queue
    if (currentUser.userPaths.length > 0) {
      return {
        queuePosition: 0,
        estimatedTimeSeconds: 0,
        success: true,
      };
    }

    // Find all users without userPaths, sorted by creation date
    const usersInQueue = await prisma.user.findMany({
      where: {
        userPaths: {
          none: {},
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    // Find position of current user in the queue
    const queuePosition =
      usersInQueue.findIndex((user) => user.id === userId) + 1;

    // Calculate estimated completion time
    let estimatedTimeMinutes = 0;

    if (queuePosition > 1) {
      // There are users ahead in the queue
      const precedingUsers = queuePosition - 1;
      estimatedTimeMinutes =
        precedingUsers * USER_PROCESSING_TIME_MINUTES +
        USER_PROCESSING_TIME_MINUTES;
    } else if (queuePosition === 1) {
      // User is first in queue - calculate based on user creation time
      const now = new Date();
      const userCreatedAt = currentUser.createdAt;
      
      // Calculate how long the user has been in the queue (in minutes)
      const queueTimeMinutes = (now.getTime() - userCreatedAt.getTime()) / (1000 * 60);
      
      // Estimate remaining time
      const remainingMinutes = Math.max(0, USER_PROCESSING_TIME_MINUTES - queueTimeMinutes);
      estimatedTimeMinutes = Math.ceil(remainingMinutes);
      
      // If timer would have expired, set to a minimum time
      if (estimatedTimeMinutes <= 0) {
        estimatedTimeMinutes = 1;
      }
    }

    // Convert minutes to seconds
    const estimatedTimeSeconds = Math.round(estimatedTimeMinutes * 60);

    return {
      queuePosition,
      estimatedTimeSeconds,
      success: true,
    };
  } catch (error) {
    console.error('Error getting onboarding status:', error);
    return {
      queuePosition: 0,
      estimatedTimeSeconds: 0,
      success: false,
      message: 'An error occurred while checking your status.',
    };
  }
}
