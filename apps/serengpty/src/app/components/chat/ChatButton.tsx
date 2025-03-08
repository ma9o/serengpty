'use client';

import { Button } from '@enclaveid/ui/button';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { useStreamChatUser } from './StreamChatUserContext';
import { useChatClient } from '../../services/streamChat';
import { useStartChat } from './useStartChat';
import { toast } from 'sonner';

interface ChatButtonProps {
  otherUserId: string;
  otherUserName: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  initialText?: string;
}

export function ChatButton({
  otherUserId,
  otherUserName,
  variant = 'default',
  size = 'sm',
  className,
  initialText,
}: ChatButtonProps) {
  const { userId, userToken, userName } = useStreamChatUser();
  const { client } = useChatClient(userId, userToken, userName);
  const { startChatWithUser, isLoading, error } = useStartChat();

  const handleClick = async () => {
    if (!userId) {
      toast.error('You must be logged in to start a chat');
      return;
    }

    if (!otherUserId) {
      toast.error('Cannot start chat with invalid user');
      return;
    }

    // Make sure client is initialized
    if (!client) {
      toast.error('Chat client not initialized. Please try again later.');
      return;
    }

    try {
      console.log('Starting chat with:', { userId, otherUserId });

      const result = await startChatWithUser(
        userId,
        otherUserId,
        client,
        otherUserName,
        initialText
      );

      if (!result) {
        toast.error(`Failed to start chat${error ? `: ${error.message}` : ''}`);
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
