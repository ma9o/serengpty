import { Tabs, TabsContent, TabsList, TabsTrigger } from '@enclaveid/ui/tabs';
import { SimilarUsersTab } from './SimilarUsersTab';
import { ChatsTab } from './ChatsTab';

export function Dashboard() {
  return (
    <Tabs defaultValue="Similar Users">
      <TabsList>
        <TabsTrigger value="Similar Users">Similar Users</TabsTrigger>
        <TabsTrigger value="Your Chats">Your Chats</TabsTrigger>
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
