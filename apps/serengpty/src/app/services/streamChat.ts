'use client';

import { StreamChat } from 'stream-chat';
import { useEffect, useState, useRef } from 'react';

// These should be environment variables in production
const API_KEY = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!;

// Create a properly managed singleton for the StreamChat client
// This pattern ensures we only create one instance throughout the app lifecycle
class ChatClientSingleton {
  private static instance: StreamChat | null = null;
  private static notificationCallbacks: Set<(count: number) => void> = new Set();
  private static isListening = false;

  public static getInstance(): StreamChat {
    if (!this.instance) {
      this.instance = StreamChat.getInstance(API_KEY);
    }
    return this.instance;
  }

  public static registerNotificationCallback(callback: (count: number) => void) {
    this.notificationCallbacks.add(callback);

    // If client is already connected, update the newly registered callback
    if (this.instance && this.instance.userID) {
      this.updateCallback(callback);
    }

    // Return unregister function
    return () => {
      this.notificationCallbacks.delete(callback);
    };
  }

  private static async updateCallback(callback: (count: number) => void) {
    if (!this.instance) return;

    try {
      const unreadData = await this.instance.getUnreadCount();
      const totalUnread = unreadData.total_unread_count || 0;
      callback(totalUnread);
    } catch (err) {
      console.error('Error getting unread count for callback:', err);
    }
  }

  public static setupNotificationListeners(client: StreamChat) {
    if (this.isListening) return;

    const updateNotifications = async () => {
      if (!client) return;

      try {
        const unreadData = await client.getUnreadCount();
        const totalUnread = unreadData.total_unread_count || 0;

        // Notify all registered callbacks
        this.notificationCallbacks.forEach((callback) => callback(totalUnread));
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
    this.isListening = true;
  }

  public static getTestToken(userId: string) {
    const client = this.getInstance();
    // This is only for development
    // WARNING: Never use this in production!
    return client.devToken(userId);
  }
}

export const useChatClient = (
  userId: string,
  userToken: string,
  userName: string
) => {
  const [client, setClient] = useState<StreamChat | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const hasSetupClient = useRef(false);

  useEffect(() => {
    // Clear loading state if we don't have required params
    if (!userId || !userToken) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const chatClient = ChatClientSingleton.getInstance();
    
    // Set up event handlers
    const handleConnectionError = (event: Error) => {
      console.error('Connection error:', event);
      if (isMounted) {
        setError(event);
      }
    };

    const connectUser = async () => {
      try {
        setIsLoading(true);

        // Check if the user is already connected with the same ID
        if (chatClient.userID === userId) {
          if (isMounted) {
            setClient(chatClient);
            setIsLoading(false);
          }
          return;
        }

        // If a different user was previously connected, disconnect
        if (chatClient.userID) {
          await chatClient.disconnectUser();
        }

        // Connect the user
        await chatClient.connectUser(
          {
            id: userId,
            name: userName,
          },
          userToken
        );

        // Set up notification listeners if not already listening
        ChatClientSingleton.setupNotificationListeners(chatClient);

        // Update the state with connected client if component is still mounted
        if (isMounted) {
          setClient(chatClient);
        }
      } catch (error) {
        if (isMounted) {
          if (error instanceof Error) {
            setError(error);
          } else {
            setError(new Error('Unknown error occurred'));
          }
        }
        console.error('Error connecting user:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Add error handler
    chatClient.on('connection.error', handleConnectionError);
    
    // Connect user only once per mount
    if (!hasSetupClient.current) {
      connectUser();
      hasSetupClient.current = true;
    }

    return () => {
      isMounted = false; // Prevent state updates after unmount
      chatClient.off('connection.error', handleConnectionError);
    };
  }, [userId, userToken, userName]);

  return {
    client,
    isLoading,
    error,
  };
};

// Register to listen for notification updates - use the singleton method
export function registerNotificationCallback(callback: (count: number) => void) {
  return ChatClientSingleton.registerNotificationCallback(callback);
}

// Get test token - use the singleton method
export function getTestToken(userId: string) {
  return ChatClientSingleton.getTestToken(userId);
}
