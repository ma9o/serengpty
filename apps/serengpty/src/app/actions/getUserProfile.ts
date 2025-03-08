'use server';

import { prisma } from '../services/db/prisma';
import { auth } from '../services/auth';
import { generateUsername } from 'unique-username-generator';
import { validateUsername } from './validateUsername';

// Helper function to generate a unique username
async function generateUniqueUsername() {
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

/**
 * Gets the current user's profile data from the database
 * If the user doesn't have a name yet, it generates a unique username
 */
export async function getUserProfile() {
  try {
    // Get current user from session
    const session = await auth();
    if (!session?.user?.id) {
      return null;
    }

    const userId = session.user.id;

    // Fetch user data from database
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        country: true,
        sensitiveMatching: true,
      },
    });

    // If no user data found, return null
    if (!userData) {
      return null;
    }

    // If user doesn't have a name yet, generate a unique username
    if (!userData.name) {
      userData.name = await generateUniqueUsername();
    }

    return userData;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}
