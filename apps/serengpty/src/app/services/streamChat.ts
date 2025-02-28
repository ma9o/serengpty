'use client';

import { StreamChat } from 'stream-chat';
import { useEffect, useState } from 'react';

// These should be environment variables in production
const API_KEY = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!;

// Create a singleton instance of the StreamChat client
// for use throughout the application
let chatClient: StreamChat | undefined;

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
export const getTestToken = (userId: string) => {
  if (!chatClient) {
    chatClient = StreamChat.getInstance(API_KEY);
  }

  // This is only for development
  // WARNING: Never use this in production!
  return chatClient.devToken(userId);
};
