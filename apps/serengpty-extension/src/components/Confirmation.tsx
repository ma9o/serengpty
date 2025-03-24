import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@enclaveid/ui/card';
import { Button } from '@enclaveid/ui/button';
import { addActivatedConversation } from '../utils/storage';
import { useState } from 'react';

export function Confirmation({
  onConfirm,
  conversationId,
  title,
}: {
  onConfirm?: () => void;
  conversationId: string;
  title: string;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!conversationId) {
      return;
    }

    setIsLoading(true);
    try {
      await addActivatedConversation(conversationId);
      console.log('Activating conversation:', conversationId);
      onConfirm?.();
    } catch (error) {
      console.error('Error activating conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="m-8">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-gray-500">
          Find others chatting on:
        </CardTitle>
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          If you confirm, we'll show you which other ChatGPT users are chatting
          on the same topic.
          <br />
          <br />
          Don't worry too much about it being uncomfortable: accounts are
          anonymous and the raw content is never shown verbatim.
        </p>
      </CardContent>
      <CardFooter className="flex items-center justify-center">
        <Button onClick={handleConfirm} disabled={isLoading}>
          {isLoading ? 'Activating...' : 'Confirm'}
        </Button>
      </CardFooter>
    </Card>
  );
}
