'use client';

import { StreamChat } from 'stream-chat';
import { useEffect, useState } from 'react';

// These should be environment variables in production
const API_KEY = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!;

// Create a singleton instance of the StreamChat client
// for use throughout the application
let chatClient: StreamChat | undefined;

// Global event listeners for notification tracking
let isListening = false;
let notificationCallbacks: ((count: number) => void)[] = [];

export const useChatClient = (userId?: string, userToken?: string) => {
  const [client, setClient] = useState<StreamChat | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (!userId || !userToken) {
      setIsLoading(false);
      return;
    }

    // Initialize the chat client if it doesn't exist
    if (!chatClient) {
      chatClient = StreamChat.getInstance(API_KEY);
    }

    // Set up event handlers
    const handleConnectionError = (event: Error) => {
      console.error('Connection error:', event);
      setError(event);
    };

    const connectUser = async () => {
      try {
        setIsLoading(true);

        // Check if the user is already connected
        if (chatClient?.userID === userId) {
          setClient(chatClient);
          setIsLoading(false);
          return;
        }

        // If a different user was previously connected, disconnect
        if (chatClient?.userID) {
          await chatClient.disconnectUser();
        }

        // Connect the user
        await chatClient!.connectUser(
          {
            id: userId,
            name: userId,
          },
          userToken
        );

        // Update the state with connected client
        setClient(chatClient);

        // Set up global notification listeners if not already listening
        if (!isListening && chatClient) {
          setupNotificationListeners(chatClient);
        }
      } catch (error) {
        if (error instanceof Error) {
          setError(error);
        } else {
          setError(new Error('Unknown error occurred'));
        }
        console.error('Error connecting user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    chatClient?.on('connection.error', handleConnectionError);
    connectUser();

    return () => {
      chatClient?.off('connection.error', handleConnectionError);
    };
  }, [userId, userToken]);

  return {
    client,
    isLoading,
    error,
  };
};

// Function to generate a token for testing
// In production, tokens should be generated server-side
// Set up global notification listeners
function setupNotificationListeners(client: StreamChat) {
  if (isListening) return;
  
  const updateNotifications = async () => {
    if (!client) return;
    
    try {
      // Get unread count from the client
      const unreadData = await client.getUnreadCount();
      const totalUnread = unreadData.total_unread_count || 0;
      
      // Notify all registered callbacks
      notificationCallbacks.forEach(callback => callback(totalUnread));
    } catch (err) {
      console.error('Error getting unread count:', err);
    }
  };
  
  // Set up event listeners for notifications
  client.on('notification.message_new', updateNotifications);
  client.on('notification.mark_read', updateNotifications);
  client.on('channel.truncated', updateNotifications);
  
  // Do initial update
  updateNotifications();
  
  // Mark as listening
  isListening = true;
}

// Register to listen for notification updates
export function registerNotificationCallback(callback: (count: number) => void) {
  notificationCallbacks.push(callback);
  
  // If we already have a client and it's connected, update immediately
  if (chatClient && chatClient.userID) {
    chatClient.getUnreadCount().then(data => {
      const count = data.total_unread_count || 0;
      callback(count);
    }).catch(err => {
      console.error('Error getting initial unread count:', err);
    });
  }
  
  // Return function to unregister
  return () => {
    notificationCallbacks = notificationCallbacks.filter(cb => cb !== callback);
  };
}

export const getTestToken = (userId: string) => {
  if (!chatClient) {
    chatClient = StreamChat.getInstance(API_KEY);
  }

  // This is only for development
  // WARNING: Never use this in production!
  return chatClient.devToken(userId);
};

export const createStreamChatUser = async (userId: string) => {
  if (!chatClient) {
    chatClient = StreamChat.getInstance(API_KEY);
  }

  await chatClient.upsertUser({ id: userId, role: 'user' });
};
