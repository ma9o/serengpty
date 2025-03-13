'use client';

import { useEffect, useState, useRef } from 'react';
import { ChannelFilters } from 'stream-chat';
import {
  Channel,
  ChannelHeader,
  ChannelList,
  DefaultStreamChatGenerics,
  MessageInput,
  MessageList,
  Thread,
  useMobileNavigation,
  Window,
} from 'stream-chat-react';
import { Avatar, AvatarImage, AvatarFallback } from '@enclaveid/ui/avatar';
import { Button } from '@enclaveid/ui/button';
import { Menu } from 'lucide-react';
import { getIdenticon } from '../../utils/getIdenticon';
import { useChatContext } from './ChatProvider';
import { useIsMobile } from '@enclaveid/ui/hooks/use-mobile';

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

export const ChatInterface = ({
  activeChannelId: propActiveChannelId,
}: ChatInterfaceProps) => {
  const {
    client,
    isLoading,
    activeChannelId: contextActiveChannelId,
    setActiveChannelId,
    initialChatText,
    setInitialChatText,
  } = useChatContext();

  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);
  const channelListRef = useRef<HTMLDivElement>(null);

  const [activeChannel, setActiveChannel] = useState<string | undefined>(
    propActiveChannelId || contextActiveChannelId || undefined
  );

  const [localInitialText, setLocalInitialText] = useState<string | null>(
    initialChatText
  );

  // Use the mobile navigation hook
  useMobileNavigation(channelListRef, navOpen, () => setNavOpen(false));

  // Check for channel ID in URL on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const channelId = url.searchParams.get('cid');
      if (channelId) {
        setActiveChannel(channelId);
        setActiveChannelId(channelId);
      }
    }
  }, [setActiveChannelId]);

  // Update from context if it changes
  useEffect(() => {
    if (contextActiveChannelId) {
      setActiveChannel(contextActiveChannelId);
      // Close mobile nav when a channel is selected
      if (isMobile) {
        setNavOpen(false);
      }
    }
  }, [contextActiveChannelId, isMobile]);

  // Store initialChatText in local state and clear the context
  useEffect(() => {
    if (initialChatText) {
      setLocalInitialText(initialChatText);
      // Clear the context value after capturing it locally
      setInitialChatText(null);
    }
  }, [initialChatText, setInitialChatText]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  // If client is not available, don't render the chat interface
  if (!client) {
    return null;
  }

  // Prepare filters with the user ID
  const filters: ChannelFilters<DefaultStreamChatGenerics> = {
    type: 'messaging',
    members: { $in: [client.userID || ''] },
  };

  return (
    <div className="flex h-full overflow-auto relative">
      <div className="flex h-full w-full">
        {/* Mobile menu button */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-50"
            onClick={() => setNavOpen(!navOpen)}
          >
            <Menu className="h-10 w-10" />
          </Button>
        )}

        {/* Channel list - conditionally visible on mobile */}
        <div
          ref={channelListRef}
          className={`${
            isMobile
              ? navOpen
                ? 'absolute top-0 left-0 h-full z-40 bg-background shadow-xl'
                : 'hidden'
              : 'relative'
          } w-64 border-r dark:border-gray-800 overflow-y-auto`}
        >
          <ChannelList
            customActiveChannel={activeChannel}
            filters={filters}
            sort={{ last_message_at: -1 }}
            options={{ state: true, presence: true, limit: 10 }}
            Avatar={CustomAvatar}
          />
        </div>

        {/* Chat area - add padding when mobile menu button is present */}
        <div className={`flex-1 overflow-auto`}>
          <Channel
            Avatar={
              // Disable avatars in thread
              () => <></>
            }
          >
            <Window>
              <ChannelHeader Avatar={CustomAvatar} />
              <MessageList />
              <MessageInput
                focus
                noFiles
                getDefaultValue={() => localInitialText || ''}
                grow={true}
              />
            </Window>
            <Thread />
          </Channel>
        </div>
      </div>
    </div>
  );
};
