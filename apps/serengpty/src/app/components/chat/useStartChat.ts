'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StreamChat } from 'stream-chat';
import { useChatClient } from '../../services/streamChat';
import { useCreateChannel } from './useCreateChannel';

export const useStartChat = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const startChatWithUser = async (
    currentUserId: string, 
    otherUserId: string, 
    chatClient: StreamChat | undefined,
    channelName?: string
  ) => {
    if (!chatClient) {
      setError(new Error('Chat client not initialized'));
      return null;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Create a channel ID based on the two user IDs
      const channelId = [currentUserId, otherUserId].sort().join('-');
      
      let channel = chatClient.channel('messaging', channelId);
      
      // Check if the channel exists
      try {
        await channel.watch();
      } catch (error) {
        // Channel doesn't exist, create it
        channel = chatClient.channel('messaging', channelId, {
          members: [currentUserId, otherUserId],
          name: channelName,
          created_by_id: currentUserId,
        });
        
        await channel.create();
      }
      
      // Navigate to the chat page
      router.push('/dashboard/chats');
      
      return channel;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to start chat');
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
    error
  };
};