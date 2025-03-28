import { Tabs, TabsContent, TabsList, TabsTrigger } from '@enclaveid/ui/tabs';
import { Badge } from '@enclaveid/ui/badge';
import { SimilarUsersTab } from './SimilarUsersTab';
import { ChatsTab } from './ChatsTab';
import { useState, useCallback, useRef } from 'react';
import { useActiveChannel } from '@enclaveid/ui-utils';

interface DashboardProps {
  unreadCount?: number;
}

const tabs = {
  SIMILAR_USERS: 'Similar Users',
  YOUR_CHATS: 'Your Chats',
};

export function Dashboard({ unreadCount = 0 }: DashboardProps) {
  const [tab, setActiveTab] = useState(tabs.SIMILAR_USERS);
  const { setActiveChannelId } = useActiveChannel();
  const pendingChannelId = useRef<string | null>(null);

  const onChatButtonClick = useCallback(
    (channelId: string) => {
      pendingChannelId.current = channelId;
      setActiveChannelId(channelId);
      setActiveTab(tabs.YOUR_CHATS);
    },
    [setActiveChannelId]
  );

  return (
    <Tabs
      defaultValue={tabs.SIMILAR_USERS}
      value={tab}
      onValueChange={setActiveTab}
      className="w-full h-full"
    >
      <TabsList className="w-full">
        <TabsTrigger value={tabs.SIMILAR_USERS} className="w-full">
          Similar Users
        </TabsTrigger>
        <TabsTrigger
          value={tabs.YOUR_CHATS}
          className="flex items-center gap-1 w-full"
        >
          Your Chats
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value={tabs.SIMILAR_USERS}
        //forceMount
        hidden={tab !== tabs.SIMILAR_USERS}
      >
        <SimilarUsersTab onChatButtonClick={onChatButtonClick} />
      </TabsContent>
      <TabsContent
        value={tabs.YOUR_CHATS}
        //forceMount
        hidden={tab !== tabs.YOUR_CHATS}
      >
        <ChatsTab />
      </TabsContent>
    </Tabs>
  );
}
