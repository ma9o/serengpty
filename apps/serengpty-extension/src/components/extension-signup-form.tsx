import { useCallback } from 'react';
import { SignupForm } from '@enclaveid/ui/signup-form';
import { validateUsername as validateUsernameUtil, validatePassword as validatePasswordUtil } from '@enclaveid/shared-utils';

export function ExtensionSignupForm() {
  const getOnSubmit = useCallback(
    (setError: (error: string) => void) =>
      async (username: string, password: string) => {
        try {
          // Here you would implement the actual signup logic
          // For example, calling your API endpoint
          const response = await fetch('https://your-api.com/signup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
          });

          if (!response.ok) {
            const data = await response.json();
            setError(data.error || 'Failed to sign up');
            return;
          }

          // Handle successful signup
          console.log('Signed up successfully');
          
          // Optionally, you can automatically log in the user or redirect
          // window.location.href = '/dashboard';
        } catch (error) {
          console.error('Error during signup:', error);
          setError('An error occurred during sign up');
        }
      },
    []
  );

  // Using validation utilities from shared-utils
  const validateUsername = async (username: string) => {
    return validateUsernameUtil(username);
  };

  const validatePassword = async (password: string) => {
    return validatePasswordUtil(password);
  };

  return (
    <SignupForm 
      getOnSubmit={getOnSubmit}
      validateUsername={validateUsername}
      validatePassword={validatePassword}
    />
  );
}