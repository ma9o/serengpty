'use client';

import { Button } from '@enclaveid/ui/button';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { useUser } from './UserContext';
import { useChatClient } from '../../services/streamChat';
import { useStartChat } from './useStartChat';
import { toast } from 'sonner';

interface ChatButtonProps {
  otherUserId: string;
  otherUserName: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ChatButton({
  otherUserId,
  otherUserName,
  variant = 'default',
  size = 'sm',
  className,
}: ChatButtonProps) {
  const { userId } = useUser();
  const { client } = useChatClient(userId || '', ''); // Token will be fetched in the hook
  const { startChatWithUser, isLoading, error } = useStartChat();

  const handleClick = async () => {
    if (!userId) {
      toast.error('You must be logged in to start a chat');
      return;
    }

    try {
      await startChatWithUser(
        userId,
        otherUserId,
        client,
        `Chat with ${otherUserName}`
      );

      if (error) {
        toast.error(`Failed to start chat: ${error.message}`);
      }
    } catch (err) {
      console.error('Error in chat button:', err);
      toast.error('Failed to start a chat. Please try again.');
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading}
      className={className}
    >
      <ChatBubbleIcon className="mr-2 h-4 w-4" />
      {isLoading ? 'Connecting...' : 'Message ' + otherUserName}
    </Button>
  );
}
