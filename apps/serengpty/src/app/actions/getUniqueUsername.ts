import { generateUsername } from 'unique-username-generator';
import { validateUsername } from './validateUsername';
import { getCurrentUser } from './getCurrentUser';

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
 * Generates a unique username
 */
export async function getUniqueUsername(): Promise<string> {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    return currentUser.name || generateUniqueUsername();
  } else {
    return generateUniqueUsername();
  }
}
