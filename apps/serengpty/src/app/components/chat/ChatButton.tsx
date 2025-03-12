'use client';

import { Button } from '@enclaveid/ui/button';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { useChatContext } from './ChatProvider';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { client, setActiveChannelId, setInitialChatText } = useChatContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!client || !client.userID) {
      toast.error('You must be logged in to start a chat');
      return;
    }

    if (!otherUserId) {
      toast.error('Cannot start chat with invalid user');
      return;
    }

    try {
      setIsLoading(true);
      
      // Create a channel between the two users
      const channel = client.channel('messaging', {
        members: [client.userID, otherUserId],
        created_by_id: client.userID,
      });

      await channel.watch();

      // Set active channel in context
      if (channel.id) {
        setActiveChannelId(channel.id);
        
        // Store the initial text if provided
        if (initialText) {
          setInitialChatText(initialText);
        }
      }

      // Navigate to the chat page with the specific channel ID
      router.push(`/dashboard/chats?cid=${encodeURIComponent(channel.id)}`);
    } catch (err) {
      console.error('Error starting chat:', err);
      toast.error('Failed to start a chat. Please try again.');
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
      <ChatBubbleIcon className="mr-2 h-4 w-4" />
      {isLoading ? 'Connecting...' : 'Message ' + otherUserName}
    </Button>
  );
}