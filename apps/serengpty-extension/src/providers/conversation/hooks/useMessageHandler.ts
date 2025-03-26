import { useCallback } from 'react';
import { ProcessingMetadata } from '../types';
import { hashConversation } from '../../../utils/content';
import { conversationStatesStorage } from '../../../utils/storage';
import { ConversationChangedMessage } from '../../../utils/messaging/types';

/**
 * Hook to handle conversation messages from the background script
 * This updated version no longer extracts messages from the DOM directly
 */
export function useMessageHandler(
  conversationId: string | null,
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>,
  setTitle: React.Dispatch<React.SetStateAction<string | null>>,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setSimilarUsers: React.Dispatch<React.SetStateAction<any[]>>,
  setContentHash: React.Dispatch<React.SetStateAction<string | null>>,
  setProcessingMetadata: React.Dispatch<React.SetStateAction<ProcessingMetadata>>,
  setProcessingError: React.Dispatch<React.SetStateAction<string | null>>
) {
  const handleMessage = useCallback(
    async (message: ConversationChangedMessage) => {
      // If changing to a different conversation, reset all states
      if (conversationId !== message.conversationId) {
        // Reset all states
        setMessages([]);
        setSimilarUsers([]);
        setContentHash(null);
        setTitle(null);
        // Reset processing metadata for new conversation
        setProcessingMetadata({
          lastProcessedHash: null,
          lastProcessedAt: null,
          error: null
        });
        setProcessingError(null);
        console.log(`Resetting state for new conversation: ${message.conversationId}`);
      }
      
      // Set the new conversation ID
      setConversationId(message.conversationId);
      
      // Update title if provided
      if (message.title) {
        setTitle(message.title);
        console.log(`Setting conversation title to: "${message.title}"`);
      }
      
      // Check if we received messages with this event
      if (message.messages && message.messages.length > 0) {
        setMessages(message.messages);
        
        // Use content hash from message or generate one
        const newHash = message.contentHash || hashConversation(message.messages);
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
                lastProcessedAt: new Date(state.lastProcessed),
                error: state.error || null
              });
              // Also set the processing error in the context
              if (state.error) {
                setProcessingError(state.error);
              } else {
                setProcessingError(null);
              }
            }
          }
        } catch (error) {
          console.error('Error loading conversation state:', error);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [conversationId, setConversationId, setTitle, setMessages, setIsLoading, setSimilarUsers, setContentHash, setProcessingMetadata, setProcessingError]
  );

  return handleMessage;
}