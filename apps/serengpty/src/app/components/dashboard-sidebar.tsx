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

    const handleUnreadCount = (event: any) => {
      if (event.total_unread_count !== undefined) {
        setUnreadCount(event.total_unread_count);
      }
    };

    client.on(handleUnreadCount);

    return () => {
      client.off(handleUnreadCount);
    };
  }, [client, setUnreadCount]);

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
    <AppSidebar LogoutButton={<LogoutButton />} sidebarItems={sidebarItems} />
  );
}
