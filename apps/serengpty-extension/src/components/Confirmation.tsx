import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@enclaveid/ui/card';
import { Button } from '@enclaveid/ui/button';
import { addActivatedConversation } from '../utils/storage';
import { dispatchCloseSidepanel } from '../utils/messaging/sidepanel';
import { useState } from 'react';

export function Confirmation({
  onConfirm,
  conversationId,
}: {
  onConfirm?: () => void;
  conversationId: string;
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

  const handleCancel = () => {
    dispatchCloseSidepanel();
  };

  return (
    <Card className="m-8">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Match on "{conversationId}" ?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Would you like to activate this conversation to find similar users?
          This will allow the extension to process the content of this conversation.
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading}
        >
          {isLoading ? 'Activating...' : 'Confirm'}
        </Button>
      </CardFooter>
    </Card>
  );
}
