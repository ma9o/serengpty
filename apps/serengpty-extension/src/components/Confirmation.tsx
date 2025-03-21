import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@enclaveid/ui/card';
import { Button } from '@enclaveid/ui/button';
import { addActivatedConversation } from '../utils/storage';

export function Confirmation({
  onConfirm,
  conversationId,
  conversationTitle,
}: {
  onConfirm?: () => void;
  conversationId: string;
  conversationTitle: string;
}) {
  return (
    <Card className="m-8">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Match on "{conversationTitle}" ?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This is a confirmation message. Please confirm that you want to
          proceed.
        </p>
      </CardContent>
      <CardFooter className="flex justify-center">
        {/* <div className="flex items-center gap-2">
          <Checkbox
            checked={dontAskAgain}
            onCheckedChange={updateDontAskAgain}
          />
          <Label>Don't ask again</Label>
        </div> */}
        <Button
          onClick={() => {
            if (!conversationId) {
              return;
            }

            addActivatedConversation(conversationId).then(() => {
              console.log('Activating conversation:', conversationId);
              onConfirm?.();
            });
          }}
        >
          Confirm
        </Button>
      </CardFooter>
    </Card>
  );
}
