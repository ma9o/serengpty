'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileForm } from '../../components/onboarding/profile-form';
import { Toaster } from '@enclaveid/ui/toaster';
import { Loader2 } from 'lucide-react';
import { getOnboardingStatus } from '../../actions/getOnboardingStatus';

// Helper function to format seconds into a readable time string
function formatTimeFromSeconds(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [queuePosition, setQueuePosition] = useState<number>(0);
  const [estimatedTimeSeconds, setEstimatedTimeSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Function to fetch queue status
    const fetchQueueStatus = async () => {
      try {
        const status = await getOnboardingStatus();
        if (status.success) {
          setQueuePosition(status.queuePosition);
          setEstimatedTimeSeconds(status.estimatedTimeSeconds);

          // If estimatedTimeSeconds is 0, redirect to dashboard
          if (status.estimatedTimeSeconds === 0) {
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('Error fetching queue status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch initially
    fetchQueueStatus();

    // Poll for updates every 30 seconds
    const intervalId = setInterval(fetchQueueStatus, 30000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-offwhite bg-gray-50 px-2 sm:px-4 py-6 sm:py-12 overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <h1 className="mb-3 sm:mb-4 text-center text-3xl sm:text-4xl font-bold flex items-center justify-center gap-2 sm:gap-3 px-3">
          <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" /> Processing
          your data
        </h1>
        <div className="mb-6 sm:mb-12 flex flex-col items-center space-y-2 px-3">
          <p className="w-full max-w-md text-center text-muted-foreground text-sm sm:text-base">
            {isLoading ? (
              'Checking status...'
            ) : queuePosition > 0 ? (
              <>
                Queue position{' '}
                <span className="font-medium">{queuePosition}</span> • Est. time
                left:{' '}
                <span className="font-medium">
                  {formatTimeFromSeconds(estimatedTimeSeconds)}
                </span>
              </>
            ) : (
              'Your data is being processed...'
            )}
          </p>
          <p className="w-full max-w-md text-center text-xs sm:text-sm text-muted-foreground">
            You can complete your profile below while you wait.
          </p>
        </div>

        <div className="w-full px-2 sm:px-4">
          <ProfileForm isPreferences={false} />
        </div>

        <Toaster />
      </div>
    </div>
  );
}
