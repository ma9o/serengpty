'use client';

import { useEffect, useState } from 'react';
import { ChannelFilters } from 'stream-chat';
import {
  Channel,
  ChannelHeader,
  DefaultStreamChatGenerics,
  ChannelList,
  MessageInput,
  MessageList,
  Thread,
  Window,
  useChatContext,
} from 'stream-chat-react';

interface ChatInterfaceProps {
  activeChannelId?: string;
}

// Empty state component for when no chats are active
const EmptyState = () => (
  <div className="flex h-full w-full flex-col items-center justify-center">
    <div className="text-center">
      <h3 className="mb-2 text-lg font-semibold">No chats found</h3>
      <p className="text-sm text-gray-500">
        Start a conversation to see it here
      </p>
    </div>
  </div>
);

export const ChatInterface = ({ activeChannelId }: ChatInterfaceProps) => {
  // Start with no filters until we have a valid userId
  const [filters, setFilters] = useState<{
    type: string;
    members?: { $in: string[] };
  }>({
    type: 'messaging',
  });
  const [hasChannels, setHasChannels] = useState<boolean | null>(null);

  // Update filters when the user changes
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('user-info') || '{}');
    const userId = userInfo.id;

    if (userId) {
      console.log('Setting filters with userId:', userId);
      setFilters({
        type: 'messaging',
        members: { $in: [userId] },
      });
    } else {
      console.warn('No userId available for chat filters');
    }
  }, []);

  // Custom list component that can check if channels exist
  const CustomChannelList = (props: any) => {
    const { client } = useChatContext();

    useEffect(() => {
      if (client) {
        const checkChannels = async () => {
          try {
            // Make sure userID is valid before querying
            if (!client.userID) {
              console.error('No valid userID available for channel query');
              setHasChannels(false);
              return;
            }

            // Use the exact same filter format as mentioned in the error message
            const filter = {
              type: 'messaging',
              members: { $in: [client.userID] },
            } as ChannelFilters<DefaultStreamChatGenerics>;

            console.log(
              'Checking channels with filter:',
              JSON.stringify(filter)
            );

            const response = await client.queryChannels(filter);
            setHasChannels(response.length > 0);
          } catch (error) {
            console.error('Error checking channels:', error);
            setHasChannels(false);
          }
        };

        checkChannels();
      }
    }, [client]);

    return <ChannelList {...props} />;
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] overflow-hidden rounded-lg border shadow">
      <div className="flex h-full w-full">
        <div className="w-64 border-r dark:border-gray-800">
          <CustomChannelList
            filters={filters}
            sort={{ last_message_at: -1 }}
            options={{ state: true, presence: true, limit: 10 }}
          />
        </div>
        <div className="flex-1">
          {hasChannels === false ? (
            <EmptyState />
          ) : (
            <Channel>
              <Window>
                <ChannelHeader />
                <MessageList />
                <MessageInput focus />
              </Window>
              <Thread />
            </Channel>
          )}
        </div>
      </div>
    </div>
  );
};
