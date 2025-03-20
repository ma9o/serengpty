import { cn } from '@enclaveid/ui-utils';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Logo } from './logo';
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface SignupFormProps extends React.ComponentPropsWithoutRef<'div'> {
  getOnSubmit: (
    setError: (error: string) => void
  ) => (username: string, password: string) => void;
  validateUsername?: (username: string) => Promise<{
    isValid: boolean;
    message?: string;
  }>;
  validatePassword?: (password: string) => Promise<{
    isValid: boolean;
    message?: string;
  }>;
  getUniqueUsername?: () => Promise<string>;
}

export function SignupForm({
  className,
  getOnSubmit,
  validateUsername,
  validatePassword,
  getUniqueUsername,
  ...props
}: SignupFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Fetch a unique username if the function is provided
  useEffect(() => {
    const fetchUsername = async () => {
      if (getUniqueUsername) {
        const generatedUsername = await getUniqueUsername();
        setUsername(generatedUsername);
      }
    };
    fetchUsername();
  }, [getUniqueUsername]);

  // Validate username when it changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (username && validateUsername) {
        const result = await validateUsername(username);
        setUsernameError(
          result.isValid ? '' : result.message || 'Username is invalid'
        );
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, validateUsername]);

  // Validate password when it changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (password && validatePassword) {
        const result = await validatePassword(password);
        setPasswordError(
          result.isValid ? '' : result.message || 'Password is invalid'
        );
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [password, validatePassword]);

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setProcessing(true);

          // Perform client-side validation if validate functions are provided
          let isValid = true;

          if (validateUsername && username) {
            const usernameValidation = await validateUsername(username);
            if (!usernameValidation.isValid) {
              setUsernameError(usernameValidation.message || 'Invalid username');
              isValid = false;
            }
          }

          if (validatePassword && password) {
            const passwordValidation = await validatePassword(password);
            if (!passwordValidation.isValid) {
              setPasswordError(passwordValidation.message || 'Invalid password');
              isValid = false;
            }
          }

          // Basic validation
          if (!username || !password) {
            setError('Username and password are required');
            setProcessing(false);
            return;
          }

          if (!isValid) {
            setProcessing(false);
            return;
          }

          // Call the onSubmit handler provided by the parent
          try {
            getOnSubmit(setError)(username, password);
          } finally {
            setProcessing(false);
          }
        }}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-col items-center gap-2 font-medium">
              <div className="flex h-8 w-8 items-center justify-center rounded-md">
                <Logo />
              </div>
              <span className="sr-only">SerenGPTy</span>
            </div>
            <h1 className="text-xl font-bold">Create an Account</h1>
            <div className="text-center text-sm">
              Join the community of AI users
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  autoComplete="username"
                />
                {username && validateUsername && (
                  !usernameError ? (
                    <CheckCircle
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500"
                      size={16}
                    />
                  ) : (
                    <XCircle
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500"
                      size={16}
                    />
                  )
                )}
              </div>
              {usernameError && (
                <p className="text-sm text-red-500">{usernameError}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pr-10"
                  required
                  autoComplete="new-password"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {password && validatePassword && (
                    !passwordError ? (
                      <CheckCircle className="text-green-500" size={16} />
                    ) : (
                      <XCircle className="text-red-500" size={16} />
                    )
                  )}
                </div>
              </div>
              {passwordError && (
                <p className="text-sm text-red-500">{passwordError}</p>
              )}
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <Button 
              type="submit" 
              className="w-full"
              disabled={processing || (validateUsername && !!usernameError) || (validatePassword && !!passwordError)}
            >
              {processing ? 'Creating account...' : 'Sign up'}
            </Button>
          </div>
        </div>
      </form>
      <div className="text-balance text-center text-xs text-muted-foreground [&_button]:underline [&_button]:underline-offset-4 hover:[&_button]:text-primary">
        By clicking continue, you agree to our <button type="button">Terms of Service</button>{' '}
        and <button type="button">Privacy Policy</button>.
      </div>
    </div>
  );
}