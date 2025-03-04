'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StreamChat } from 'stream-chat';

export const useStartChat = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startChatWithUser = async (
    currentUserId: string,
    otherUserId: string,
    chatClient: StreamChat | undefined,
    otherUserName: string
  ) => {
    if (!chatClient) {
      setError(new Error('Chat client not initialized'));
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create a channel ID based on the two user IDs
      const channel = chatClient.channel('messaging', {
        members: [currentUserId, otherUserId],
        created_by_id: currentUserId,
        name: `${otherUserName}`,
      });

      await channel.watch();

      // Navigate to the chat page with the specific channel ID
      router.push(`/dashboard/chats?cid=${encodeURIComponent(channel.id)}`);

      return channel;
    } catch (err) {
      const errorObj =
        err instanceof Error ? err : new Error('Failed to start chat');
      setError(errorObj);
      console.error('Error starting chat:', errorObj);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    startChatWithUser,
    isLoading,
    error,
  };
};
