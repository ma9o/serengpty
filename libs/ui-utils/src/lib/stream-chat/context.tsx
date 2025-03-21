'use client';

/**
 * Stream Chat Context Provider
 *
 * This context provides Stream Chat functionality to React components
 * in a framework-agnostic way, compatible with both Next.js and browser extensions.
 */
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
import { ChatNotificationEvent } from '@enclaveid/shared-utils';

interface ChatContextType {
  client: StreamChat | null;
  isLoading: boolean;
  error: Error | null;
  unreadCount: number;
  activeChannelId: string | null;
  setActiveChannelId: (channelId: string | null) => void;
  initialChatText: string | null;
  setInitialChatText: (text: string | null) => void;
  handleNewMessage?: (event: ChatNotificationEvent) => void;
}

const ChatContext = createContext<ChatContextType>({
  client: null,
  isLoading: true,
  error: null,
  unreadCount: 0,
  activeChannelId: null,
  setActiveChannelId: () => {
    /* Default empty implementation */
  },
  initialChatText: null,
  setInitialChatText: () => {
    /* Default empty implementation */
  },
});

export const useChatContext = () => useContext(ChatContext);

interface ChatProviderProps {
  userId: string;
  userName: string;
  userToken: string;
  children: ReactNode;
  apiKey: string;
  className?: string;
  onNewMessage?: (event: ChatNotificationEvent) => void;
  onUnreadCountChange?: (count: number) => void;
}

export const ChatProvider = ({
  userId,
  userName,
  userToken,
  apiKey,
  children,
  className,
  onNewMessage,
  onUnreadCountChange,
}: ChatProviderProps) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [initialChatText, setInitialChatText] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Use the Stream Chat hook pattern with memoized parameters
  const chatClientParams = useMemo(
    () => ({
      apiKey: apiKey,
      tokenOrProvider: userToken,
      userData: { id: userId, name: userName },
    }),
    [apiKey, userId, userName, userToken]
  );

  const client = useCreateChatClient(chatClientParams);

  // Set up notification listeners
  useEffect(() => {
    if (!client) return;

    const handleUnreadCount = (event: any) => {
      if (event.total_unread_count !== undefined) {
        const count = event.total_unread_count;
        setUnreadCount(count);

        // Notify external handler if provided
        if (onUnreadCountChange) {
          onUnreadCountChange(count);
        }
      }
    };

    // Handle new message events
    const handleNewMessage = (event: any) => {
      if (event.message && onNewMessage) {
        const notificationEvent: ChatNotificationEvent = {
          totalUnreadCount: event.total_unread_count,
          channelId: event.channel?.id,
          messageText: event.message.text,
          senderId: event.message.user?.id,
          senderName: event.message.user?.name,
        };

        onNewMessage(notificationEvent);
      }
    };

    client.on(handleUnreadCount);
    client.on('message.new', handleNewMessage);

    // Get initial unread count
    client.getUnreadCount().then((unreadData) => {
      if (unreadData?.total_unread_count !== undefined) {
        setUnreadCount(unreadData.total_unread_count);

        // Notify external handler for initial count
        if (onUnreadCountChange) {
          onUnreadCountChange(unreadData.total_unread_count);
        }
      }
    });

    return () => {
      client.off(handleUnreadCount);
      client.off('message.new', handleNewMessage);
    };
  }, [client, onUnreadCountChange, onNewMessage]);

  const setActiveChannelIdCallback = useCallback((channelId: string | null) => {
    setActiveChannelId(channelId);
  }, []);

  const setInitialChatTextCallback = useCallback((text: string | null) => {
    setInitialChatText(text);
  }, []);

  // Handle new message wrapped in a callback
  const handleNewMessageCallback = useCallback(
    (event: ChatNotificationEvent) => {
      if (onNewMessage) {
        onNewMessage(event);
      }
    },
    [onNewMessage]
  );

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
      handleNewMessage: handleNewMessageCallback,
    }),
    [
      client,
      error,
      unreadCount,
      activeChannelId,
      setActiveChannelIdCallback,
      initialChatText,
      setInitialChatTextCallback,
      handleNewMessageCallback,
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
      <Chat client={client}>{children}</Chat>
    </ChatContext.Provider>
  );
};
