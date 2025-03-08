'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { validateUsername } from '../../actions/validateUsername';
import { useDebouncedCallback } from 'use-debounce';

interface UsernameStatusProps {
  username: string;
  isValid: boolean;
  setIsValid: (isValid: boolean) => void;
}

export function UsernameStatus({
  username,
  isValid,
  setIsValid,
}: UsernameStatusProps) {
  const [validationState, setValidationState] = useState<
    'idle' | 'loading' | 'valid' | 'invalid'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const debouncedValidation = useDebouncedCallback(async (value: string) => {
    setValidationState('loading');

    try {
      const result = await validateUsername(value);
      if (result.isValid) {
        setValidationState('valid');
        setIsValid(true);
        setErrorMessage(undefined);
      } else {
        setValidationState('invalid');
        setIsValid(false);
        setErrorMessage(result.message);
      }
    } catch (error) {
      setValidationState('invalid');
      setIsValid(false);
      setErrorMessage('Error checking username');
      console.error('Username validation error:', error);
    }
  }, 300);

  useEffect(() => {
    debouncedValidation(username);

    return () => {
      debouncedValidation.cancel();
    };
  }, [username, debouncedValidation]);

  if (validationState === 'idle') {
    return null;
  }

  return (
    <div className="flex items-center mt-1">
      {validationState === 'loading' && (
        <div className="flex items-center text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          <span className="text-xs">Checking availability...</span>
        </div>
      )}

      {validationState === 'valid' && (
        <div className="flex items-center text-green-500">
          <CheckCircle className="h-4 w-4 mr-1" />
          <span className="text-xs">Username available</span>
        </div>
      )}

      {validationState === 'invalid' && (
        <div className="flex items-center text-red-500">
          <XCircle className="h-4 w-4 mr-1" />
          <span className="text-xs">
            {errorMessage || 'Username unavailable'}
          </span>
        </div>
      )}
    </div>
  );
}
