'use server';

import { z } from 'zod';
import { prisma } from '../services/db/prisma';
import { auth } from '../services/auth';
import { revalidatePath } from 'next/cache';

// Form validation schema
const userProfileSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters.' })
    .max(20, { message: 'Username cannot be longer than 20 characters.' })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: 'Username can only contain letters, numbers, and underscores.',
    }),
  country: z.string(),
  sensitiveMatching: z.boolean().default(false),
});

export type UserProfileFormData = z.infer<typeof userProfileSchema>;

/**
 * Saves the user profile data from the onboarding form
 */
export async function saveUserProfile(
  data: UserProfileFormData
): Promise<{ success: boolean; message?: string }> {
  try {
    // Validate the form data
    const validationResult = userProfileSchema.safeParse(data);
    if (!validationResult.success) {
      return {
        success: false,
        message: validationResult.error.errors[0].message,
      };
    }

    // Get current user from session
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        message: 'You must be logged in to save your profile.',
      };
    }

    const userId = session.user.id;

    // Check if username is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { username: data.username },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      return {
        success: false,
        message: 'This username is already taken.',
      };
    }

    // Update or create the user profile
    await prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        country: data.country,
        sensitiveMatching: data.sensitiveMatching,
      },
    });

    // Revalidate paths that might display user data
    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/profile');

    return { success: true };
  } catch (error) {
    console.error('Error saving user profile:', error);
    return {
      success: false,
      message: 'An error occurred while saving your profile.',
    };
  }
}