import { useCallback } from 'react';
import { ConversationMessageEvent, ProcessingMetadata } from '../types';
import { extractConversation, hashConversation } from '../../../utils/content';
import { conversationStatesStorage } from '../../../utils/storage';

/**
 * Hook to handle conversation messages from the background script
 */
export function useMessageHandler(
  conversationId: string | null,
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setSimilarUsers: React.Dispatch<React.SetStateAction<any[]>>,
  setContentHash: React.Dispatch<React.SetStateAction<string | null>>,
  setProcessingMetadata: React.Dispatch<React.SetStateAction<ProcessingMetadata>>
) {
  const handleMessage = useCallback(
    async (message: ConversationMessageEvent) => {
      if (message.action === 'conversationChanged' && message.conversationId) {
        // If changing to a different conversation, reset all states
        if (conversationId !== message.conversationId) {
          // Reset all states
          setMessages([]);
          setSimilarUsers([]);
          setContentHash(null);
          // Reset processing metadata for new conversation
          setProcessingMetadata({
            lastProcessedHash: null,
            lastProcessedAt: null
          });
          console.log(`Resetting state for new conversation: ${message.conversationId}`);
        }
        
        // Set the new conversation ID
        setConversationId(message.conversationId);
        
        // Check if we received messages with this event
        if (message.messages && message.messages.length > 0) {
          setMessages(message.messages);
          // Generate and store hash for this content
          const newHash = hashConversation(message.messages);
          setContentHash(newHash);
        }
        
        // If we just have a navigation event (no messages), load stored state
        else {
          // Reset states for UI while we load
          setIsLoading(true);
          
          try {
            // Load conversation state from storage
            const states = await conversationStatesStorage.getValue();
            const state = states[message.conversationId];
            
            if (state) {
              // Set cached similar users if available
              if (state.similarUsers && state.similarUsers.length > 0) {
                setSimilarUsers(state.similarUsers);
              }
              
              // If we have a saved content hash, restore it
              if (state.contentHash) {
                setContentHash(state.contentHash);
              }
              
              // Restore processing metadata from state if available
              if (state.contentHash && state.lastProcessed) {
                setProcessingMetadata({
                  lastProcessedHash: state.contentHash,
                  lastProcessedAt: new Date(state.lastProcessed)
                });
              }
              
              // Attempt to extract fresh messages from DOM
              const domMessages = extractConversation();
              if (domMessages.length > 0) {
                setMessages(domMessages);
                const newHash = hashConversation(domMessages);
                
                // Only update processing state if hash has changed
                if (newHash !== state.contentHash) {
                  console.log('Fresh DOM content different from stored content');
                  setContentHash(newHash);
                  // Reset processing metadata since content has changed
                  setProcessingMetadata(prev => ({
                    ...prev,
                    lastProcessedHash: null
                  }));
                }
              }
            }
          } catch (error) {
            console.error('Error loading conversation state:', error);
          } finally {
            setIsLoading(false);
          }
        }
      }
    },
    [conversationId, setConversationId, setMessages, setIsLoading, setSimilarUsers, setContentHash, setProcessingMetadata]
  );

  return handleMessage;
}