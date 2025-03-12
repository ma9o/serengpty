// layout.tsx
'use server';

import { Separator } from '@enclaveid/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@enclaveid/ui/sidebar';
import { DashboardBreadcrumb } from '../../components/dashboard-breadcrumb';
import { UnviewedMatchesProvider } from '../../components/serendipitous-paths/UnviewedMatchesContext';
import { ChatProvider } from '../../components/chat/ChatProvider';
import { DashboardSidebar } from '../../components/dashboard-sidebar';

import { getChatToken } from '../../actions/getChatToken';
import { getCurrentUser } from '../../actions/getCurrentUser';

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-full">
      <DashboardSidebar />
      <SidebarInset className="h-full">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <DashboardBreadcrumb />
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const streamChatToken = await getChatToken();

  return (
    <div className="h-full">
      <UnviewedMatchesProvider>
        <ChatProvider
          userId={user?.id}
          userName={user?.name}
          userToken={streamChatToken.token}
        >
          <DashboardLayout>{children}</DashboardLayout>
        </ChatProvider>
      </UnviewedMatchesProvider>
    </div>
  );
}
