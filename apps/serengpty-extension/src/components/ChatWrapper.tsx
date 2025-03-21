import { ReactNode, useEffect, useState } from 'react';
import { ChatProvider } from '@enclaveid/ui-utils';
import { ChatNotificationEvent } from '@enclaveid/shared-utils';
import { getChatToken } from '../services/api';
import { userDataStorage } from '../utils/storage';
import { showChatNotification } from '../utils/notifications';

interface ChatWrapperProps {
  children: ReactNode;
  onUnreadCountChange?: (count: number) => void;
}

export function ChatWrapper({ children, onUnreadCountChange }: ChatWrapperProps) {
  const [userData, setUserData] = useState<{ userId: string; name: string } | null>(null);
  const [chatToken, setChatToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stream Chat API key from environment variables
  const streamChatApiKey = import.meta.env.VITE_STREAM_CHAT_API_KEY as string;

  // Fetch user data and chat token
  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        
        // Get user data from storage
        const storedUserData = await userDataStorage.getValue();
        
        if (!storedUserData) {
          setError('User not found');
          setLoading(false);
          return;
        }
        
        setUserData(storedUserData);
        
        // Get chat token for the user
        const tokenResult = await getChatToken(storedUserData.userId);
        
        if (tokenResult.error || !tokenResult.token) {
          setError(tokenResult.error || 'Failed to get chat token');
          setLoading(false);
          return;
        }
        
        setChatToken(tokenResult.token);
      } catch (err) {
        setError('Failed to initialize chat');
        console.error('Chat initialization error:', err);
      } finally {
        setLoading(false);
      }
    }
    
    initialize();
  }, []);

  // Handle new message notification
  const handleNewMessage = (event: ChatNotificationEvent) => {
    // Only show notification if the message is from someone else
    if (userData && event.senderId && event.senderId !== userData.userId) {
      showChatNotification(event);
    }
  };

  // Handle error state for the chat
  if (error && !loading) {
    console.warn('Chat initialization error:', error);
    // We still render children, but chat functionality won't be available
  }

  // If still loading or missing required data, just render children without chat functionality
  if (loading || !userData || !chatToken || !streamChatApiKey) {
    return <>{children}</>;
  }

  return (
    <ChatProvider
      userId={userData.userId}
      userName={userData.name}
      userToken={chatToken}
      apiKey={streamChatApiKey}
      onUnreadCountChange={onUnreadCountChange}
      onNewMessage={handleNewMessage}
    >
      {children}
    </ChatProvider>
  );
}