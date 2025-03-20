import { useEffect, useState } from 'react';
import { AuthForm } from './AuthForm';

interface AuthCheckerProps {
  children: React.ReactNode;
}

export function AuthChecker({ children }: AuthCheckerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  async function checkAuthentication() {
    try {
      setIsLoading(true);

      // Import auth service
      const { authService } = await import('../../services/auth');

      // Check if user is authenticated
      const isValid = await authService.isAuthenticated();
      setIsAuthenticated(isValid);
    } catch (error) {
      console.error('Error checking authentication:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    checkAuthentication();
  }, []);

  async function handleAuthenticated() {
    setIsAuthenticated(true);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return isAuthenticated ? (
    <>{children}</>
  ) : (
    <AuthForm onAuthenticated={handleAuthenticated} />
  );
}
