'use client';

import { OnboardingForm } from '../../components/onboarding/onboarding-form';
import { Toaster } from '@enclaveid/ui/toaster';
import { Loader2 } from 'lucide-react';

export default function OnboardingPage() {
  // Mock values - these would be fetched from an API in a real app
  const queuePosition = 3;
  const estimatedTime = '2 minutes';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <h1 className="mb-4 text-center text-4xl font-bold flex items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" /> Processing
          your data
        </h1>
        <div className="mb-12 flex flex-col items-center space-y-2">
          <p className="max-w-md text-center text-muted-foreground">
            Processing data: Queue position{' '}
            <span className="font-medium">{queuePosition}</span> • Est. time:{' '}
            <span className="font-medium">{estimatedTime}</span>
          </p>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            You can complete your profile below while you wait.
          </p>
        </div>

        <OnboardingForm />

        <Toaster />
      </div>
    </div>
  );
}
