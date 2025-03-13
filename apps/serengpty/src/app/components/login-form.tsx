'use client';

import { cn } from '@enclaveid/ui-utils';
import { Button } from '@enclaveid/ui/button';
import { Input } from '@enclaveid/ui/input';
import { Label } from '@enclaveid/ui/label';
import { Logo } from '@enclaveid/ui/logo';
import { Eye, EyeOff } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const formData = new FormData(e.currentTarget);

          const username = formData.get('username') as string;
          const password = formData.get('password') as string;

          if (!username || !password) {
            setError('Username and password are required');
            return;
          }

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
        }}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md">
                <Logo />
              </div>
              <span className="sr-only">SerenGPTy</span>
            </a>
            <h1 className="text-xl font-bold">Welcome to SerenGPTy</h1>
            <div className="text-center text-sm">Find ChatGPT and Claude users who think like you</div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                required
                autoComplete="username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="pr-10"
                  required
                  autoComplete="current-password"
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
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <Button type="submit" className="w-full">
              Log in
            </Button>
          </div>
        </div>
      </form>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary  ">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{' '}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  );
}
