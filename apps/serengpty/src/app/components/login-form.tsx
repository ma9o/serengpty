'use client';

import { cn } from '@enclaveid/ui-utils';
import { Button } from '@enclaveid/ui/button';
import { Input } from '@enclaveid/ui/input';
import { Label } from '@enclaveid/ui/label';
import { Logo } from '@enclaveid/ui/logo';
import { signIn } from 'next-auth/react';

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          // Call SignIn with our credentials provider and password
          await signIn('credentials', {
            password: formData.get('password') as string,
            callbackUrl: '/dashboard/home',
          });
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
              <span className="sr-only">EnclaveID</span>
            </a>
            <h1 className="text-xl font-bold">Welcome to EnclaveID</h1>
            <div className="text-center text-sm">Get LLMs to know you</div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              <p className="text-xs text-muted-foreground">
                Enter the password you created during signup
              </p>
            </div>
            <Button type="submit" className="w-full">
              Continue
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
