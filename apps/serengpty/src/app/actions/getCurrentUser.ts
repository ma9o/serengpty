'use server';

import { auth } from '../services/auth';

export async function getCurrentUser() {
  try {
    const session = await auth();

    if (!session?.user) {
      return null;
    }

    return {
      id: session.user.id!,
      name: session.user.name!,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}
