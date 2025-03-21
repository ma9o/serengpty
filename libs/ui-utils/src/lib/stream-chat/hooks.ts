'use client';
import { useCallback, useState } from 'react';
import { useChatContext } from './context';

/**
 * Hook to manage the active chat channel
 * @returns Hook methods and state for channel management
 */
export const useActiveChannel = () => {
  const { activeChannelId, setActiveChannelId, client } = useChatContext();

  /**
   * Create or join a direct message channel with another user
   * @param otherUserId ID of the user to chat with
   * @returns Promise resolving to the channel ID
   */
  const createDirectChannel = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!client || !client.userID) {
        throw new Error(
          'Chat client not initialized or user not authenticated'
        );
      }

      try {
        // Create a channel between the two users
        const channel = client.channel('messaging', {
          members: [client.userID, otherUserId],
          created_by_id: client.userID,
        });

        await channel.watch();

        if (channel.id) {
          setActiveChannelId(channel.id);
          return channel.id;
        }

        return null;
      } catch (error) {
        console.error('Error creating direct message channel:', error);
        throw error;
      }
    },
    [client, setActiveChannelId]
  );

  return {
    activeChannelId,
    setActiveChannelId,
    createDirectChannel,
  };
};

/**
 * Hook for managing initial message text when opening a chat
 * @returns Hook methods and state for initial message text
 */
export const useInitialChatText = () => {
  const { initialChatText, setInitialChatText } = useChatContext();

  return {
    initialChatText,
    setInitialChatText,
  };
};

/**
 * Hook for managing chat notification state and unread counts
 * @returns Hook methods and state for notifications
 */
export const useChatNotifications = () => {
  const { unreadCount, client } = useChatContext();
  const [isChannelActive, setIsChannelActive] = useState<boolean>(false);

  /**
   * Mark all messages in a channel as read
   * @param channelId ID of the channel to mark as read
   */
  const markChannelRead = useCallback(
    async (channelId: string) => {
      if (!client) return;

      try {
        const channel = client.channel('messaging', channelId);
        await channel.markRead();
      } catch (error) {
        console.error('Error marking channel as read:', error);
      }
    },
    [client]
  );

  /**
   * Set whether a channel is currently being viewed by the user
   * @param active Whether the channel is active/visible
   */
  const setChannelActive = useCallback((active: boolean) => {
    setIsChannelActive(active);
  }, []);

  return {
    unreadCount,
    isChannelActive,
    setChannelActive,
    markChannelRead,
  };
};
