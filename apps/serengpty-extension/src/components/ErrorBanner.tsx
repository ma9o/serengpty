import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@enclaveid/ui/alert';
import { Button } from '@enclaveid/ui/button';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <Alert variant="destructive" className="mb-4 relative">
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="mt-1">
        <div className="flex flex-col gap-2">
          <p>{message}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2 w-full"
            >
              Retry
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}