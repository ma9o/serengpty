'use client';

import { UserProvider, useUser } from '../../../components/chat/UserContext';
import { ChatProvider } from '../../../components/chat/ChatProvider';
import { ChatInterface } from '../../../components/chat/ChatInterface';

// Wrapper component that handles the user authentication and chat initialization
const ChatApp = () => {
  const { userId, userToken, isLoading, error } = useUser();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="ml-2 text-gray-600">Loading user data...</p>
      </div>
    );
  }

  if (error || !userId || !userToken) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <h2 className="text-xl font-semibold text-red-500">
          {error ? 'Error loading user data' : 'User data not available'}
        </h2>
        <p className="mt-2 text-gray-600">
          {error?.message || 'Please make sure you are logged in.'}
        </p>
      </div>
    );
  }

  return (
    <ChatProvider userId={userId} userToken={userToken}>
      <ChatInterface />
    </ChatProvider>
  );
};

// Main page component
const ChatsPage = () => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1">
        <UserProvider>
          <ChatApp />
        </UserProvider>
      </div>
    </div>
  );
};

export default ChatsPage;
