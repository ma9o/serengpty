'use client';

import { ChatInterface } from '../../../components/chat/ChatInterface';
import { useChatContext } from '../../../components/chat/ChatProvider';

// Main page component
const ChatsPage = () => {
  const { client, error, isLoading } = useChatContext();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin border-4 border-gray-300 border-t-blue-600"></div>
        <p className="ml-2 text-gray-600">Loading chat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <h2 className="text-xl font-semibold text-red-500">
          Error loading chat
        </h2>
        <p className="mt-2 text-gray-600">
          {error.message || 'An unknown error occurred'}
        </p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <h2 className="text-xl font-semibold text-red-500">
          Chat not available
        </h2>
        <p className="mt-2 text-gray-600">
          Please make sure you are logged in.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  );
};

export default ChatsPage;