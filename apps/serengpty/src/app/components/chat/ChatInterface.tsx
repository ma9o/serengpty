'use client';

import { useEffect, useState } from 'react';
import {
  Channel,
  ChannelList,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from 'stream-chat-react';
import { Avatar, AvatarImage, AvatarFallback } from '@enclaveid/ui/avatar';
import { getIdenticon } from '../../utils/getIdenticon';

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

// Custom avatar component using identicons
const CustomAvatar = (props: any) => {
  const { image, name, size } = props;
  const userId = props.userId || name;

  return (
    <div className={`str-chat__avatar str-chat__avatar--${size}`}>
      <Avatar>
        <AvatarImage
          src={image || (userId ? getIdenticon(userId) : undefined)}
          alt={name || 'User avatar'}
        />
        <AvatarFallback>
          {name ? name.substring(0, 2).toUpperCase() : '??'}
        </AvatarFallback>
      </Avatar>
    </div>
  );
};

export const ChatInterface = ({ activeChannelId }: ChatInterfaceProps) => {
  // Start with no filters until we have a valid userId
  const [filters, setFilters] = useState<{
    type: string;
    members?: { $in: string[] };
  }>({
    type: 'messaging',
  });
  const [hasChannels, setHasChannels] = useState<boolean | null>(null);
  const [activeChannel, setActiveChannel] = useState<string | undefined>(
    activeChannelId
  );

  // Check for channel ID in URL on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const channelId = url.searchParams.get('cid');
      if (channelId) {
        setActiveChannel(channelId);
      }
    }
  }, []);

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

  return (
    <div className="flex h-full overflow-hidden rounded-lg border shadow">
      <div className="flex h-full w-full">
        <div className="w-64 border-r dark:border-gray-800">
          <ChannelList
            customActiveChannel={activeChannel}
            filters={filters}
            sort={{ last_message_at: -1 }}
            options={{ state: true, presence: true, limit: 10 }}
            Avatar={CustomAvatar}
          />
        </div>
        <div className="flex-1">
          {hasChannels === false ? (
            <EmptyState />
          ) : (
            <Channel>
              <Window>
                {/* <ChannelHeader /> */}
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
