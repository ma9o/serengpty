'use server';

import { signIn } from '../services/auth';

export async function signInUser(username: string, password: string) {
  return await signIn('credentials', {
    username,
    password,
    redirect: false,
  });
}
