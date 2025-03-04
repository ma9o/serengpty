'use client';

import { useEffect, useState } from 'react';
import { ChannelFilters } from 'stream-chat';
import {
  Channel,
  ChannelList,
  DefaultStreamChatGenerics,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from 'stream-chat-react';
import { Avatar, AvatarImage, AvatarFallback } from '@enclaveid/ui/avatar';
import { getIdenticon } from '../../utils/getIdenticon';
import { useStreamChatUser } from './StreamChatUserContext';

interface ChatInterfaceProps {
  activeChannelId?: string;
}

// Custom avatar component using identicons
const CustomAvatar = (props: {
  image?: string;
  name?: string;
  size?: string;
  userId?: string;
}) => {
  const { image, name, size } = props;
  const userId = props.userId || name;

  // Convert size string to a number for the SVG generation
  const sizeMap: Record<string, number> = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 72,
  };

  const pixelSize = typeof size === 'string' ? sizeMap[size] || 40 : 40;

  return (
    <div className={`str-chat__avatar str-chat__avatar--${size}`}>
      <Avatar>
        <AvatarImage
          src={
            image ||
            (userId ? getIdenticon(userId, { size: pixelSize }) : undefined)
          }
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
  const { userId, activeChannelId: contextActiveChannelId } =
    useStreamChatUser();
  const [activeChannel, setActiveChannel] = useState<string | undefined>(
    activeChannelId || contextActiveChannelId
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

  // Update from context if it changes
  useEffect(() => {
    if (contextActiveChannelId) {
      setActiveChannel(contextActiveChannelId);
    }
  }, [contextActiveChannelId]);

  // If userId is not available, don't render the chat interface
  if (!userId) {
    return null;
  }

  // Prepare filters with the userId from context
  const filters: ChannelFilters<DefaultStreamChatGenerics> = {
    type: 'messaging',
    members: { $in: [userId] },
  };

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
          <Channel
            Avatar={
              // Disable avatars in thread
              () => <></>
            }
            markReadOnMount
          >
            <Window>
              <MessageList />
              <MessageInput focus noFiles />
            </Window>
            <Thread />
          </Channel>
        </div>
      </div>
    </div>
  );
};
