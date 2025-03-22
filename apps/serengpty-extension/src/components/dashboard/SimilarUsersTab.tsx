import { useEffect } from 'react';
import { useConversation } from '../../providers';

export function SimilarUsersTab() {
  const {
    conversationId,
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

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Similar Conversations</h3>
        <button
          className="text-xs text-blue-500 hover:text-blue-700"
          onClick={() => processConversation(true)}
        >
          Refresh
        </button>
      </div>
      {similarUsers.map((user) => (
        <div
          key={user.userId + user.conversationId}
          className="border rounded-lg p-4 hover:bg-gray-100 cursor-pointer"
        >
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center mr-2">
                <span>{user.userName.charAt(0)}</span>
              </div>
              <h4 className="text-md font-medium">{user.userName}</h4>
            </div>
            <span className="text-xs text-gray-500">
              Similarity: {(user.distance * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-sm truncate">{user.title}</p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
      ))}
      {processingMetadata.lastProcessedAt && (
        <p className="text-xs text-gray-500 text-right">
          Last updated:{' '}
          {processingMetadata.lastProcessedAt.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
