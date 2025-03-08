'use server';

import { prisma } from '../services/db/prisma';
import { getCurrentUser } from './getCurrentUser';

// Each user's parallel portion, in minutes
const PARALLEL_PORTION_MINUTES = 6;

// Each user's blocking portion, in minutes
const BLOCKING_PORTION_MINUTES = 2;

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
    // 1. Get current user from session
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

    // 2. Check if user already has userPaths
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

    // 3. If user already has paths, they're not in the queue
    if (currentUser.userPaths.length > 0) {
      return {
        queuePosition: 0,
        estimatedTimeSeconds: 0,
        success: true,
      };
    }

    // 4. Find all users without userPaths, sorted by creation date
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

    // 5. We'll loop to find:
    //    - queuePosition (index + 1)
    //    - how many minutes from "now" until the *current user* finishes
    const now = new Date();
    let blockEndTime = 0; // in minutes from now
    let queuePosition = 0; // will increment as we iterate
    let estimatedTimeMinutes = 0;

    for (const queueUser of usersInQueue) {
      queuePosition++;

      // (A) How long the queueUser has already been waiting (in minutes)
      const timeInQueue =
        (now.getTime() - queueUser.createdAt.getTime()) / (1000 * 60);

      // (B) Parallel portion left for this user
      let parallelTimeRemaining = PARALLEL_PORTION_MINUTES - timeInQueue;
      if (parallelTimeRemaining < 0) {
        parallelTimeRemaining = 0;
      }

      // (C) They can't start blocking until:
      //     - Their parallel portion is done
      //     - The previous user's blocking portion has finished
      const startBlocking = Math.max(blockEndTime, parallelTimeRemaining);

      // (D) Blocking finishes 2 minutes later
      const finishBlocking = startBlocking + BLOCKING_PORTION_MINUTES;
      blockEndTime = finishBlocking;

      // (E) If this is our user, we know how long from now it takes to finish
      if (queueUser.id === userId) {
        estimatedTimeMinutes = blockEndTime;
        break;
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
