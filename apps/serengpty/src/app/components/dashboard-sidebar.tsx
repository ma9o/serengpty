'use client';

import { AppSidebar } from '@enclaveid/ui/app-sidebar';
import {
  HomeIcon,
  ChatBubbleIcon,
  MixerHorizontalIcon,
} from '@radix-ui/react-icons';
import { useChatContext } from './chat/ChatProvider';
import { LogoutButton } from './logout-button';
import { useUnviewedMatches } from './serendipitous-paths/UnviewedMatchesContext';
import { useEffect } from 'react';

export function DashboardSidebar() {
  const { unreadCount, client, setUnreadCount } = useChatContext();
  const { unviewedCount } = useUnviewedMatches();
  
  // Set up notification listeners
  useEffect(() => {
    if (!client) return;
    
    const updateUnreadCount = async () => {
      try {
        // Get updated unread count from the client
        const unreadData = await client.getUnreadCount();
        if (unreadData?.total_unread_count !== undefined && setUnreadCount) {
          setUnreadCount(unreadData.total_unread_count);
        }
      } catch (err) {
        console.error('Error updating unread count:', err);
      }
    };
    
    // Listen for notification events
    client.on('notification.message_new', updateUnreadCount);
    client.on('notification.mark_read', updateUnreadCount);
    client.on('channel.truncated', updateUnreadCount);
    
    // Initial update
    updateUnreadCount();
    
    return () => {
      // Clean up event listeners
      client.off('notification.message_new', updateUnreadCount);
      client.off('notification.mark_read', updateUnreadCount);
      client.off('channel.truncated', updateUnreadCount);
    };
  }, [client]);
  
  const sidebarItems = {
    navMain: [
      {
        title: 'Dashboard',
        items: [
          {
            title: 'Home',
            url: '/dashboard/home',
            icon: <HomeIcon />,
            badge: unviewedCount > 0 ? unviewedCount : undefined,
          },
          {
            title: 'Chats',
            url: '/dashboard/chats',
            icon: <ChatBubbleIcon />,
            badge: unreadCount > 0 ? unreadCount : undefined,
          },
        ],
      },
      {
        title: 'Settings',
        items: [
          {
            title: 'Preferences',
            url: '/dashboard/preferences',
            icon: <MixerHorizontalIcon />,
          },
        ],
      },
    ],
  };

  return (
    <AppSidebar
      LogoutButton={<LogoutButton />}
      sidebarItems={sidebarItems}
    />
  );
}