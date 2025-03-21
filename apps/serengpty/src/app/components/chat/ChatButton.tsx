'use client';

import { ChatButton as SharedChatButton } from '@enclaveid/ui';
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

export function ChatButton(props: ChatButtonProps) {
  const router = useRouter();

  // Handle error
  const handleError = (error: Error) => {
    console.error('Error starting chat:', error);
    toast.error('Failed to start a chat. Please try again.');
  };

  // Handle channel creation success
  const handleChannelCreated = (channelId: string) => {
    // Navigate to the chat page with the specific channel ID
    router.push(`/dashboard/chats?cid=${encodeURIComponent(channelId)}`);
  };

  // Use the shared ChatButton component with Next.js navigation
  return (
    <SharedChatButton
      {...props}
      onError={handleError}
      onChannelCreated={handleChannelCreated}
    />
  );
}