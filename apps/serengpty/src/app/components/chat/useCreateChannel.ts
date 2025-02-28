'use client';

import { useState } from 'react';
import { StreamChat } from 'stream-chat';

export const useCreateChannel = (chatClient: StreamChat | undefined) => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createConversation = async (
    userId: string,
    otherUserId: string,
    options?: { name?: string; image?: string }
  ) => {
    if (!chatClient) {
      throw new Error('Chat client not initialized');
    }

    try {
      setIsCreating(true);
      setError(null);

      const members = [userId, otherUserId];
      const channelId = members.sort().join('-');

      // Create a new channel
      const channel = chatClient.channel('messaging', channelId, {
        members,
        name: options?.name,
        image: options?.image,
        created_by_id: userId,
      });

      // Initialize the channel
      await channel.create();

      return channel;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create channel');
      setError(error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createConversation,
    isCreating,
    error,
  };
};