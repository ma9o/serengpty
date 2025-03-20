import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@enclaveid/ui';
import { Logo } from '@enclaveid/ui/logo';
import { cn } from '@enclaveid/ui-utils';
import { Eye, EyeOff } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@enclaveid/ui';
import { Input } from '@enclaveid/ui';
import { useState } from 'react';

const formSchema = z.object({
  name: z.string().min(3, {
    message: 'Username must be at least 3 characters',
  }),
  password: z.string().min(8, {
    message: 'Password must be at least 8 characters',
  }),
});

interface AuthFormProps {
  onAuthenticated: () => void;
  className?: string;
}

export function AuthForm({ onAuthenticated, className }: AuthFormProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      setError(null);

      // Import dynamically to avoid circular dependencies
      const { authService } = await import('../../services/auth');

      if (isSignup) {
        await authService.signup(values);
      } else {
        await authService.login(values);
      }

      onAuthenticated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn('flex flex-col gap-6 p-4', className)}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md">
                <Logo />
              </div>
              <h1 className="text-xl font-bold">
                {isSignup ? 'Welcome to SerenGPTy' : 'Welcome back'}
              </h1>
              <div className="text-center text-sm">
                Find ChatGPT and Claude users who think like you
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="username">Username</FormLabel>
                      <FormControl>
                        <Input
                          id="username"
                          placeholder="Enter your username"
                          required
                          {...field}
                          disabled={isLoading}
                          autoComplete="username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-2">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="password">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            className="pr-10"
                            required
                            {...field}
                            disabled={isLoading}
                            autoComplete={isSignup ? 'new-password' : 'current-password'}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {error && <div className="text-sm text-red-500">{error}</div>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Processing...' : isSignup ? 'Sign up' : 'Log in'}
              </Button>
            </div>
          </div>
        </form>
      </Form>

      <div className="text-center text-sm">
        {isSignup ? (
          <p>
            Already have an account?{' '}
            <Button
              variant="link"
              className="p-0 h-auto font-semibold"
              onClick={() => setIsSignup(false)}
              disabled={isLoading}
            >
              Sign in
            </Button>
          </p>
        ) : (
          <p>
            Don't have an account?{' '}
            <Button
              variant="link"
              className="p-0 h-auto font-semibold"
              onClick={() => setIsSignup(true)}
              disabled={isLoading}
            >
              Sign up
            </Button>
          </p>
        )}
      </div>
      
      <div className="text-balance text-center text-xs text-muted-foreground [&_button]:underline [&_button]:underline-offset-4 hover:[&_button]:text-primary">
        By clicking continue, you agree to our <button type="button" className="font-normal">Terms of Service</button>{' '}
        and <button type="button" className="font-normal">Privacy Policy</button>.
      </div>
    </div>
  );
}
