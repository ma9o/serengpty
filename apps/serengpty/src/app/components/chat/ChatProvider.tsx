'use client';

import {
  ReactNode,
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { Chat, useCreateChatClient } from 'stream-chat-react';
import { StreamChat } from 'stream-chat';
import 'stream-chat-react/dist/css/v2/index.css';
import { env } from '../../constants/environment';

interface ChatContextType {
  client: StreamChat | null;
  isLoading: boolean;
  error: Error | null;
  unreadCount: number;
  activeChannelId: string | null;
  setActiveChannelId: (channelId: string | null) => void;
  initialChatText: string | null;
  setInitialChatText: (text: string | null) => void;
}

const ChatContext = createContext<ChatContextType>({
  client: null,
  isLoading: true,
  error: null,
  unreadCount: 0,
  activeChannelId: null,
  setActiveChannelId: (channelId: string | null) => {
    /* Default empty implementation */
  },
  initialChatText: null,
  setInitialChatText: (text: string | null) => {
    /* Default empty implementation */
  },
});

export const useChatContext = () => useContext(ChatContext);

interface ChatProviderProps {
  userId: string;
  userName: string;
  userToken: string;
  children: ReactNode;
  className?: string;
}

export const ChatProvider = ({
  userId,
  userName,
  userToken,
  children,
  className,
}: ChatProviderProps) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [initialChatText, setInitialChatText] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Use the Stream Chat hook pattern with memoized parameters
  const chatClientParams = useMemo(
    () => ({
      apiKey: env.NEXT_PUBLIC_STREAM_CHAT_API_KEY,
      tokenOrProvider: userToken,
      userData: { id: userId, name: userName },
    }),
    [userId, userName, userToken]
  );

  const client = useCreateChatClient(chatClientParams);

  // Set up notification listeners
  useEffect(() => {
    if (!client) return;

    const handleUnreadCount = (event: any) => {
      if (event.total_unread_count !== undefined) {
        setUnreadCount(event.total_unread_count);
      }
    };

    client.on(handleUnreadCount);

    // Get initial unread count
    client.getUnreadCount().then((unreadData) => {
      if (unreadData?.total_unread_count !== undefined) {
        setUnreadCount(unreadData.total_unread_count);
      }
    });

    return () => {
      client.off(handleUnreadCount);
    };
  }, [client, setUnreadCount]);

  const setActiveChannelIdCallback = useCallback((channelId: string | null) => {
    setActiveChannelId(channelId);
  }, []);

  const setInitialChatTextCallback = useCallback((text: string | null) => {
    setInitialChatText(text);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<ChatContextType>(
    () => ({
      client,
      isLoading: !client,
      error,
      unreadCount,
      activeChannelId,
      setActiveChannelId: setActiveChannelIdCallback,
      initialChatText,
      setInitialChatText: setInitialChatTextCallback,
    }),
    [
      client,
      error,
      unreadCount,
      activeChannelId,
      setActiveChannelIdCallback,
      initialChatText,
      setInitialChatTextCallback,
    ]
  );
  // Create error and loading fragments
  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-500">
            Error connecting to chat
          </h2>
          <p className="mt-2 text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <ChatContext.Provider value={contextValue}>
      <div className={`h-full ${className || ''}`}>
        <Chat client={client}>{children}</Chat>
      </div>
    </ChatContext.Provider>
  );
};
