'use client';

import { ChatProvider as SharedChatProvider } from '@enclaveid/ui-utils';
import { env } from '../../constants/environment';
import { usersTable } from '@enclaveid/db';

export function NextChatProvider({
  user,
  userToken,
  children,
}: {
  user: typeof usersTable.$inferSelect;
  userToken: string;
  children: React.ReactNode;
}) {
  console.log('user', user);

  return (
    <SharedChatProvider
      userId={user.id}
      userName={user.name}
      userToken={userToken}
      apiKey={env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!}
    >
      {children}
    </SharedChatProvider>
  );
}
