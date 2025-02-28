'use server';

import { z } from 'zod';
import { generateUsername } from 'unique-username-generator';
import { prisma } from '../services/db/prisma';

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
      where: { username },
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

/**
 * Generates a unique username
 */
export async function generateUniqueUsername(): Promise<string> {
  // Using unique-username-generator library to generate usernames
  // Attempt to generate a unique username up to 5 times
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = generateUsername('_', 0, 18);

    // Check if the username is available
    const { isValid } = await validateUsername(username);

    if (isValid) {
      return username;
    }
  }

  // If all attempts fail, generate a random username with timestamp
  return `user_${Date.now().toString(36)}`;
}
