'use client';

import { LoginForm } from '@enclaveid/ui/login-form';
import { signIn } from '../services/auth';
import { useCallback } from 'react';

export function CustomLoginForm() {
  const getOnSubmit = useCallback(
    (setError: (error: string) => void) =>
      async (username: string, password: string) => {
        // Call SignIn with our credentials provider, username and password
        const result = await signIn('credentials', {
          username,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError('Invalid username or password');
        } else if (result?.ok) {
          window.location.href = '/dashboard/home';
        }
      },
    []
  );

  return <LoginForm getOnSubmit={getOnSubmit} />;
}
