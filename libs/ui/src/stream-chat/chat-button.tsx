/**
 * ChatButton Component
 *
 * Reusable button to initiate chats between users,
 * usable in both web and extension environments.
 */
import { useState } from 'react';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { Button } from '../button';
import { useActiveChannel, useInitialChatText } from '@enclaveid/ui-utils';

interface ChatButtonProps {
  otherUserId: string;
  otherUserName: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  initialText?: string;
  onError?: (error: Error) => void;
  onChannelCreated?: (channelId: string) => void;
}

export function ChatButton({
  otherUserId,
  otherUserName,
  variant = 'default',
  size = 'sm',
  className,
  initialText,
  onError,
  onChannelCreated,
}: ChatButtonProps) {
  const { createDirectChannel } = useActiveChannel();
  const { setInitialChatText } = useInitialChatText();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!otherUserId) {
      const error = new Error('Cannot start chat with invalid user');
      if (onError) onError(error);
      return;
    }

    try {
      setIsLoading(true);

      // Create a direct message channel
      const channelId = await createDirectChannel(otherUserId);

      // Store the initial text if provided
      if (initialText && channelId) {
        setInitialChatText(initialText);
      }

      // Notify parent of successful channel creation
      if (channelId && onChannelCreated) {
        onChannelCreated(channelId);
      }
    } catch (err) {
      console.error('Error starting chat:', err);
      if (onError && err instanceof Error) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
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
      <ChatBubbleIcon
        className={size === 'icon' ? 'h-4 w-4' : 'mr-2 h-4 w-4'}
      />
      {size !== 'icon' &&
        (isLoading ? 'Connecting...' : 'Message ' + otherUserName)}
    </Button>
  );
}
