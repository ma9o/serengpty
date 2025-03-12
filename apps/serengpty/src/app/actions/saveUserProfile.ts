'use server';

import { prisma } from '../services/db/prisma';
import { auth } from '../services/auth';
import { revalidatePath } from 'next/cache';
import { userProfileSchema, UserProfileFormData } from '../schemas/validation';

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

    // Check if name is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { name: data.username },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      return {
        success: false,
        message: 'This name is already taken.',
      };
    }

    // Update or create the user profile
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.username,
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
