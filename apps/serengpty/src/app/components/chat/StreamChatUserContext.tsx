'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  getTestToken,
  registerNotificationCallback,
} from '../../services/streamChat';
import { getCurrentUser } from '../../actions/getCurrentUser';
import { getChatToken } from '../../actions/getChatToken';

interface StreamChatUserContextType {
  userId: string | null;
  userToken: string | null;
  userName: string | null;
  isLoading: boolean;
  error: Error | null;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  activeChannelId: string | null;
  setActiveChannelId: (channelId: string) => void;
  initialChatText: string | null;
  setInitialChatText: (text: string) => void;
}

const StreamChatUserContext = createContext<StreamChatUserContextType>({
  userId: null,
  userToken: null,
  userName: null,
  isLoading: true,
  error: null,
  unreadCount: 0,
  setUnreadCount: (count: number) => { /* Implementation to be added */ },
  activeChannelId: null,
  setActiveChannelId: (channelId: string) => { /* Implementation to be added */ },
  initialChatText: null,
  setInitialChatText: (text: string) => { /* Implementation to be added */ },
});

export const useStreamChatUser = () => useContext(StreamChatUserContext);

interface StreamChatUserProviderProps {
  children: ReactNode;
}

export const StreamChatUserProvider = ({
  children,
}: StreamChatUserProviderProps) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [initialChatText, setInitialChatText] = useState<string | null>(null);

  // Register for notification updates - use this effect only on initial mount
  useEffect(() => {
    // Create stable callback reference to avoid unregistering and re-registering
    const updateUnreadCount = (count: number) => {
      setUnreadCount(count);
    };
    
    const unregister = registerNotificationCallback(updateUnreadCount);

    // Clean up on unmount
    return () => {
      unregister();
    };
  }, []);

  // Fetch user and token on initial render only
  // This is a side effect that only needs to run once on component mount
  // No dependencies needed as this is an initialization task
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount

    const fetchUser = async () => {
      try {
        if (isMounted) setIsLoading(true);

        // Get the current user from your authentication system
        const user = await getCurrentUser();

        if (!user?.id) {
          throw new Error('User not found');
        }

        // Fetch token using server action
        let token;
        try {
          const result = await getChatToken();

          if ('error' in result) {
            throw new Error(result.error);
          }

          token = result.token;
        } catch (tokenError) {
          // Fallback to dev token if server action fails
          console.warn(
            'Falling back to dev token due to server action error:',
            tokenError
          );
          token = getTestToken(user.id);
        }

        // Only update state if component is still mounted
        if (isMounted) {
          setUserId(user.id);
          setUserToken(token);
          setUserName(user.name || null);
        }
      } catch (err) {
        console.error('Error fetching user:', err);
        if (isMounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to fetch user')
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUser();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <StreamChatUserContext.Provider
      value={{
        userId,
        userToken,
        userName,
        isLoading,
        error,
        unreadCount,
        setUnreadCount,
        activeChannelId,
        setActiveChannelId,
        initialChatText,
        setInitialChatText,
      }}
    >
      {children}
    </StreamChatUserContext.Provider>
  );
};
