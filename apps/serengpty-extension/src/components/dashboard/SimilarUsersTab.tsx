import { useEffect, useState } from 'react';
import { useConversation } from '../../hooks/useConversation';
import { upsertConversation } from '../../services/api';
import { userDataStorage, updateConversationState, shouldProcessConversation, conversationStatesStorage, SimilarUser } from '../../utils/storage';
import { hashConversation } from '../../utils/content';

export function SimilarUsersTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [similarUsers, setSimilarUsers] = useState<SimilarUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const { conversationId, messages } = useConversation();
  
  useEffect(() => {
    // Only process if we have a conversation ID and messages
    if (!conversationId || messages.length === 0) return;
    
    // Ensure we have at least one complete user+assistant pair
    if (messages.length < 2) return;
    
    // Ensure the last message is from the assistant (complete pair)
    const lastMessageIsAssistant = messages[messages.length - 1].role === 'assistant';
    if (!lastMessageIsAssistant) return;
    
    const processConversation = async () => {
      try {
        // Check if we should process this conversation (throttling, already processing, etc.)
        if (!(await shouldProcessConversation(conversationId))) {
          // Load cached results if available
          const states = await conversationStatesStorage.getValue();
          const state = states[conversationId];
          
          if (state?.similarUsers) {
            setSimilarUsers(state.similarUsers);
          }
          return;
        }
        
        // Create a hash of the current messages for comparison
        const currentHash = hashConversation(messages);
        const states = await conversationStatesStorage.getValue();
        const state = states[conversationId];
        
        if (state?.contentHash === currentHash) {
          // Same content (hash match), use cached results
          if (state?.similarUsers) {
            setSimilarUsers(state.similarUsers);
            return;
          }
        }
        
        setIsLoading(true);
        setError(null);
        
        // Update state to processing
        await updateConversationState(conversationId, { 
          status: 'processing',
          lastProcessed: new Date().toISOString(),
          contentHash: currentHash
        });
        
        // Get user data
        const userData = await userDataStorage.getValue();
        if (!userData?.userId) {
          throw new Error('User not authenticated');
        }
        
        // Create stringified content for API call
        const contentString = JSON.stringify(messages);
        
        // Send to API
        const result = await upsertConversation({
          id: conversationId,
          title: `Conversation ${conversationId}`,
          userId: userData.userId,
          content: contentString
        });
        
        // Update state with results
        setSimilarUsers(result);
        await updateConversationState(conversationId, {
          status: 'completed',
          similarUsers: result
        });
      } catch (err) {
        console.error('Error processing conversation:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        await updateConversationState(conversationId, { status: 'idle' });
      } finally {
        setIsLoading(false);
      }
    };
    
    processConversation();
  }, [conversationId, messages]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="ml-2">Finding similar users...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Error: {error}</p>
        <button 
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => {
            if (conversationId) {
              updateConversationState(conversationId, { status: 'idle' })
                .then(() => window.location.reload());
            }
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  
  if (similarUsers.length === 0) {
    return (
      <div className="p-4 text-center">
        <p>No similar users found. Try a different conversation.</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-medium">Similar Conversations</h3>
      {similarUsers.map((user) => (
        <div key={user.userId + user.conversationId} className="border rounded-lg p-4 hover:bg-gray-100 cursor-pointer">
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
