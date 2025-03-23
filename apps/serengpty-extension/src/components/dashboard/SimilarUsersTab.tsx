import { useEffect } from 'react';
import { useConversation } from '../../providers';
import { Card, CardContent } from '@enclaveid/ui';
import { ChatButton } from '@enclaveid/ui/stream-chat/chat-button';
import { getIdenticon } from '@enclaveid/shared-utils';
import { ScoreCircle } from '@enclaveid/ui/score-circle';

export function SimilarUsersTab() {
  const {
    conversationId,
    title,
    messages,
    isLoading,
    similarUsers,
    contentHash,
    processingMetadata,
    processConversation,
  } = useConversation();

  // Process conversation automatically with content-aware processing
  useEffect(() => {
    // Basic conditions to skip processing
    if (!conversationId || messages.length === 0) {
      return;
    }

    // Skip if already loading
    if (isLoading) {
      return;
    }

    // Check if content has changed since last processing
    const contentChanged = contentHash !== processingMetadata.lastProcessedHash;

    // Check only if the content has changed, not whether we have results
    // This ensures we don't reprocess content that had no similar users
    if (!contentChanged) {
      console.log('Content unchanged, skipping processing');
      return;
    }

    // Check if last message is from the assistant (complete exchange)
    const lastMessageIsAssistant =
      messages[messages.length - 1]?.role === 'assistant';
    if (!lastMessageIsAssistant) {
      console.log('Last message not from assistant, waiting for completion');
      return;
    }

    // Debounce to avoid processing during active conversation
    const processingTimeout = setTimeout(() => {
      console.log(
        `Processing conversation with ${
          contentChanged ? 'changed' : 'new'
        } content:`,
        conversationId
      );
      processConversation(false);
    }, 1000); // 1 second debounce

    return () => clearTimeout(processingTimeout);
  }, [
    conversationId,
    contentHash,
    messages,
    isLoading,
    similarUsers,
    processingMetadata.lastProcessedHash,
    processConversation,
  ]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p className="ml-2">Finding similar users...</p>
      </div>
    );
  }

  // No similar users found
  if (similarUsers.length === 0) {
    return (
      <div className="p-4 text-center">
        <p>No similar users found. Try a different conversation.</p>
        <button
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => processConversation(true)}
        >
          Retry
        </button>
        {processingMetadata.lastProcessedAt && (
          <p className="text-xs text-gray-500 mt-2">
            Last processed:{' '}
            {processingMetadata.lastProcessedAt.toLocaleTimeString()}
          </p>
        )}
      </div>
    );
  }

  // Group conversations by user
  const userConversations = similarUsers.reduce((acc, userConv) => {
    if (!acc[userConv.userId]) {
      acc[userConv.userId] = {
        userId: userConv.userId,
        userName: userConv.userName,
        conversations: [],
      };
    }
    acc[userConv.userId].conversations.push(userConv);
    return acc;
  }, {} as Record<string, { userId: string; userName: string; conversations: typeof similarUsers }>);

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-6 px-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Also chatting about:
          </h3>
          <p className="text-md text-gray-500 line-clamp-1">
            <span className="font-medium">{title}</span>
          </p>
        </div>
        <button
          className="px-3 py-1.5 rounded-md bg-blue-500 text-white text-xs font-medium"
          onClick={() => processConversation(true)}
        >
          Refresh
        </button>
      </div>

      <div className="space-y-6">
        {Object.values(userConversations).map((userData) => (
          <Card key={userData.userId} className="overflow-hidden">
            <div className="flex px-6 py-4 items-center border-b gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden">
                <img
                  src={getIdenticon(userData.userName)}
                  alt={userData.userName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="font-medium truncate">{userData.userName}</div>
                <div className="text-xs text-gray-500">
                  {userData.conversations.length} similar conversation
                  {userData.conversations.length !== 1 ? 's' : ''}
                </div>
              </div>
              <ChatButton
                otherUserId={userData.userId}
                otherUserName={userData.userName}
                variant="outline"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onError={(error) => console.error('Chat error:', error)}
              />
            </div>
            <CardContent className="p-0">
              <div className="divide-y">
                {userData.conversations.map((conversation) => (
                  <div
                    key={conversation.conversationId}
                    className="px-6 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {conversation.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {new Date(
                            conversation.createdAt
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <ScoreCircle
                        percentage={1 - conversation.distance}
                        size="sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {processingMetadata.lastProcessedAt && (
        <p className="text-xs text-gray-500 text-right">
          Last updated:{' '}
          {processingMetadata.lastProcessedAt.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
