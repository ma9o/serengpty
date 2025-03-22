import { Tabs, TabsContent, TabsList, TabsTrigger } from '@enclaveid/ui/tabs';
import { Badge } from '@enclaveid/ui/badge';
import { SimilarUsersTab } from './SimilarUsersTab';
import { ChatsTab } from './ChatsTab';
import { useState } from 'react';

interface DashboardProps {
  unreadCount?: number;
}

const tabs = {
  SIMILAR_USERS: 'Similar Users',
  YOUR_CHATS: 'Your Chats',
};

export function Dashboard({ unreadCount = 0 }: DashboardProps) {
  const [tab, setActiveTab] = useState(tabs.SIMILAR_USERS);

  return (
    <Tabs
      defaultValue={tabs.SIMILAR_USERS}
      value={tab}
      onValueChange={setActiveTab}
    >
      <TabsList>
        <TabsTrigger value={tabs.SIMILAR_USERS}>Similar Users</TabsTrigger>
        <TabsTrigger
          value={tabs.YOUR_CHATS}
          className="flex items-center gap-1"
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
        forceMount
        hidden={tab !== tabs.SIMILAR_USERS}
      >
        <SimilarUsersTab />
      </TabsContent>
      <TabsContent
        value={tabs.YOUR_CHATS}
        forceMount
        hidden={tab !== tabs.YOUR_CHATS}
      >
        <ChatsTab />
      </TabsContent>
    </Tabs>
  );
}
