'use client';

import { ChatProvider as SharedChatProvider } from '@enclaveid/ui-utils';
import { env } from '../../constants/environment';
import { usersTable } from '@enclaveid/db';

export function NextChatProvider({
  user,
  userToken,
  children,
  enabled,
}: {
  user: typeof usersTable.$inferSelect;
  userToken: string;
  children: React.ReactNode;
  enabled?: boolean;
}) {
  return enabled ? (
    <SharedChatProvider
      userId={user.id}
      userName={user.name}
      userToken={userToken}
      apiKey={env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!}
    >
      {children}
    </SharedChatProvider>
  ) : (
    children
  );
}
