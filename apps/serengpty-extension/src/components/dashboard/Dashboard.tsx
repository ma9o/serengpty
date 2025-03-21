import { Tabs, TabsContent, TabsList, TabsTrigger } from '@enclaveid/ui/tabs';
import { Badge } from '@enclaveid/ui/badge';
import { SimilarUsersTab } from './SimilarUsersTab';
import { ChatsTab } from './ChatsTab';

interface DashboardProps {
  unreadCount?: number;
}

export function Dashboard({ unreadCount = 0 }: DashboardProps) {
  return (
    <Tabs defaultValue="Similar Users">
      <TabsList>
        <TabsTrigger value="Similar Users">Similar Users</TabsTrigger>
        <TabsTrigger value="Your Chats" className="flex items-center gap-1">
          Your Chats
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="Similar Users">
        <SimilarUsersTab />
      </TabsContent>
      <TabsContent value="Your Chats">
        <ChatsTab />
      </TabsContent>
    </Tabs>
  );
}
