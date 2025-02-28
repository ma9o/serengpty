'use client';

import { ReactNode } from 'react';
import { Chat } from 'stream-chat-react';
import { StreamChat } from 'stream-chat';
import { useChatClient } from '../../services/streamChat';
import 'stream-chat-react/dist/css/v2/index.css';

interface ChatProviderProps {
  userId: string;
  userToken: string;
  children: ReactNode;
}

export const ChatProvider = ({
  userId,
  userToken,
  children,
}: ChatProviderProps) => {
  const { client, isLoading, error } = useChatClient(userId, userToken);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-500">
            Error connecting to chat
          </h2>
          <p className="mt-2 text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {client ? (
        <Chat client={client as StreamChat}>{children}</Chat>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-gray-500">Chat client not initialized</p>
        </div>
      )}
    </div>
  );
};
