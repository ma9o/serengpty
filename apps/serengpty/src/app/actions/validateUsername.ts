'use server';

import { getPrismaClient } from '../services/db/prisma';
import { getCurrentUser } from './getCurrentUser';
import { validateUsername as validateUsernameUtil } from '@enclaveid/shared-utils';

/**
 * Validates if a username is available
 */
export async function validateUsername(username: string): Promise<{
  isValid: boolean;
  message?: string;
}> {
  const currentUser = await getCurrentUser();

  if (currentUser?.name === username) {
    return {
      isValid: true,
    };
  }

  try {
    // Validate the username format
    const validationResult = validateUsernameUtil(username);
    if (!validationResult.isValid) {
      return validationResult;
    }

    // Check if username already exists in the database
    const existingUser = await getPrismaClient()!.user.findUnique({
      where: { name: username },
      select: { id: true },
    });

    if (existingUser) {
      return {
        isValid: false,
        message: 'This username is already taken.',
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating username:', error);
    return {
      isValid: false,
      message: 'An error occurred while validating the username.',
    };
  }
}
