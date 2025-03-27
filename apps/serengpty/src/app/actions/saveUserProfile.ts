'use server';

import { auth } from '../services/auth';
import { revalidatePath } from 'next/cache';
import { userProfileSchema, UserProfileFormData } from '../schemas/validation';
import { upsertStreamChatUser } from '../utils/upsertStreamChatUser';
import { db, usersTable } from '@enclaveid/db';
import { eq } from 'drizzle-orm';

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
    const existingUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.name, data.username),
      columns: {
        id: true,
      },
    });

    if (existingUser && existingUser.id !== userId) {
      return {
        success: false,
        message: 'This name is already taken.',
      };
    }

    // Update or create the user profile
    const user = (
      await db
        .update(usersTable)
        .set({
          name: data.username,
          country: data.country,
          sensitiveMatching: data.sensitiveMatching,
        })
        .where(eq(usersTable.id, userId))
        .returning()
    )[0];

    // Update username on StreamChat
    await upsertStreamChatUser(user);

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
