'use server';

import { z } from 'zod';
import { prisma } from '../services/db/prisma';
import { getCurrentUser } from './getCurrentUser';
// Validation schema for username
const usernameSchema = z
  .string()
  .min(3, { message: 'Username must be at least 3 characters.' })
  .max(20, { message: 'Username cannot be longer than 20 characters.' })
  .regex(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores.',
  });

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
    const validationResult = usernameSchema.safeParse(username);
    if (!validationResult.success) {
      return {
        isValid: false,
        message: validationResult.error.errors[0].message,
      };
    }

    // Check if username already exists in the database
    const existingUser = await prisma.user.findUnique({
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
