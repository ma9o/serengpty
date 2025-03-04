'use client';

import { AppSidebar } from '@enclaveid/ui/app-sidebar';
import {
  HomeIcon,
  ChatBubbleIcon,
  MixerHorizontalIcon,
} from '@radix-ui/react-icons';
import { useStreamChatUser } from './chat/StreamChatUserContext';
import { LogoutButton } from './logout-button';

export function DashboardSidebar() {
  const { unreadCount } = useStreamChatUser();
  
  const sidebarItems = {
    navMain: [
      {
        title: 'Dashboard',
        items: [
          {
            title: 'Home',
            url: '/dashboard/home',
            icon: <HomeIcon />,
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