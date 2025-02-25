'use server';

import { signIn } from '../../services/auth';

export async function passwordSignIn(password: string) {
  await signIn('credentials', { password });
}