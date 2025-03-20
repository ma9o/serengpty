import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@enclaveid/ui';
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
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">
          {isSignup ? 'Create an account' : 'Login to your account'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSignup
            ? 'Enter your details below to create your account'
            : 'Enter your credentials to login to your account'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/15 border border-destructive text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder="username"
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="********"
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Processing...' : isSignup ? 'Sign up' : 'Login'}
          </Button>
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
    </div>
  );
}
