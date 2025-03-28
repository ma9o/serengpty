import { getCurrentUser } from './getCurrentUser';
import { generateUniqueUsername } from '@enclaveid/shared-browser';

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
