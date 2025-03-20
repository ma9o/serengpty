import { useCallback } from 'react';
import { LoginForm } from '@enclaveid/ui/login-form';

export function ExtensionLoginForm() {
  const getOnSubmit = useCallback(
    (setError: (error: string) => void) =>
      async (username: string, password: string) => {
        console.log('Authenticated');
      },
    []
  );

  return <LoginForm getOnSubmit={getOnSubmit} />;
}
