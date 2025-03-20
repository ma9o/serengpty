import { getUserData, UserData } from './storage';

/**
 * Get the current user ID and name from extension storage
 * Returns null if the user hasn't been registered
 */
export async function getCurrentUser(): Promise<UserData | null> {
  return await getUserData();
}

/**
 * Get just the user ID from storage
 * Useful when making authenticated API calls
 */
export async function getUserId(): Promise<string | null> {
  const userData = await getUserData();
  return userData?.userId || null;
}

/**
 * Get just the username from storage
 */
export async function getUsername(): Promise<string | null> {
  const userData = await getUserData();
  return userData?.name || null;
}