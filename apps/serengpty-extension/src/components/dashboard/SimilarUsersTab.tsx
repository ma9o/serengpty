import { useEffect, useRef } from 'react';
import { useConversation } from '../../providers';

export function SimilarUsersTab() {
  const { 
    conversationId, 
    messages, 
    isLoading, 
    isProcessed,
    similarUsers, 
    contentHash,
    processConversation 
  } = useConversation();
  
  // Keep track of the current conversation ID to avoid duplicate processing
  const processingConversationId = useRef<string | null>(null);
  const processingContentHash = useRef<string | null>(null);

  // Process conversation automatically with enhanced deduplication
  useEffect(() => {
    // Basic conditions to skip processing
    if (!conversationId || messages.length === 0 || isProcessed) {
      return;
    }
    
    // Skip if we're already processing this exact conversation and content
    const isSameConversation = processingConversationId.current === conversationId;
    const isSameContent = processingContentHash.current === contentHash;
    
    if (isSameConversation && isSameContent) {
      console.log('Skipping duplicate processing for:', conversationId);
      return;
    }
    
    // Introduce a small delay to debounce multiple rapid updates
    // This helps prevent duplicate processing when multiple state changes occur in quick succession
    const processingTimeout = setTimeout(() => {
      // Update tracking references
      processingConversationId.current = conversationId;
      processingContentHash.current = contentHash;
      
      console.log('Processing conversation:', conversationId, 'contentHash:', contentHash);
      processConversation();
    }, 100); // 100ms debounce delay
    
    // Clean up timeout if effect reruns before it fires
    return () => clearTimeout(processingTimeout);
  }, [conversationId, messages, contentHash, isProcessed, processConversation]);

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
          onClick={() => processConversation()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-medium">Similar Conversations</h3>
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
    </div>
  );
}