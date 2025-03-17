'use client';

import { Button } from '@enclaveid/ui/button';
import { Skeleton } from '@enclaveid/ui/skeleton';

export function LoadingState() {
  return (
    <div className="flex h-full">
      {/* First column loading */}
      <div className="w-1/6 border-r">
        <div className="p-4 border-b">
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="p-4 space-y-4">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Combined column loading (sections 2+3) */}
      <div className="flex-1">
        <div className="p-4 border-b">
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="p-4 space-y-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="space-y-2 mb-6">
                <div className="p-3 rounded-lg border">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ error }: { error: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="bg-destructive/10 p-6 rounded-xl text-center max-w-md">
        <h3 className="text-xl font-bold text-destructive mb-2">
          Error Loading Connections
        </h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="bg-muted p-8 rounded-xl text-center max-w-md">
        <h3 className="text-xl font-bold mb-2">No Connections Found</h3>
        <p className="text-muted-foreground mb-6">
          It looks like your data has not yet finished processing. You will be
          able to see your connections here soon.
        </p>
        <Button variant="default" asChild>
          <a href="/onboarding">Finish Onboarding</a>
        </Button>
      </div>
    </div>
  );
}
