import { useCallback } from 'react';
import { Message, hashConversation } from '../../utils/content';
import { conversationStatesStorage, updateConversationState, userDataStorage } from '../../utils/storage';

/**
 * Hook that returns a callback to process the current conversation
 */
export function useProcessConversation(
  conversationId: string | null,
  messages: Message[],
  contentHash: string | null,
  setContentHash: React.Dispatch<React.SetStateAction<string | null>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setIsProcessed: React.Dispatch<React.SetStateAction<boolean>>,
  setSimilarUsers: React.Dispatch<React.SetStateAction<any[]>>
) {
  // Create a ref to track if we're already processing
  const isProcessingRef = { current: false };

  return useCallback(async () => {
    // Log when processing is initiated with detailed info
    console.log('Processing initiated for:', conversationId, 'Hash:', contentHash);
    
    // Basic content validity checks
    if (!conversationId) {
      console.log('No conversation ID, skipping processing');
      return;
    }
    
    if (messages.length < 2) {
      console.log('Not enough messages to process (need at least 2)', messages.length);
      return;
    }
    
    // Ensure last message is from assistant (complete pair)
    const lastMessageIsAssistant = messages[messages.length - 1].role === 'assistant';
    if (!lastMessageIsAssistant) {
      console.log('Last message is not from assistant, skipping processing');
      return;
    }
    
    // Guard against concurrent processing
    if (isProcessingRef.current) {
      console.log('Already processing a conversation, skipping');
      return;
    }
    
    // Mark as processing
    isProcessingRef.current = true;
    
    try {
      setIsLoading(true);
      
      // Check if we already have this content processed
      if (contentHash) {
        const states = await conversationStatesStorage.getValue();
        const state = states[conversationId];
        
        if (state?.contentHash === contentHash && state?.similarUsers) {
          // We already have results for this content
          setSimilarUsers(state.similarUsers);
          setIsProcessed(true);
          return;
        }
      }
      
      // Mark as processing
      // Only proceed if we have a valid hash
      if (!contentHash) {
        console.warn('No content hash available, generating new one');
        const newHash = hashConversation(messages);
        setContentHash(newHash);
      }
      
      // Update processing status
      await updateConversationState(conversationId, {
        status: 'processing',
        lastProcessed: new Date().toISOString(),
        contentHash: contentHash || hashConversation(messages)
      });
      
      // Get user data
      const userData = await userDataStorage.getValue();
      if (!userData?.userId) {
        throw new Error('User not authenticated');
      }
      
      // Create API payload
      const contentString = JSON.stringify(messages);
      
      try {
        // Send to API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/upsert-conversation`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: conversationId,
              title: `Conversation ${conversationId}`,
              userId: userData.userId,
              content: contentString,
            }),
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to process conversation: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Update state
        setSimilarUsers(result);
        setIsProcessed(true);
        
        // Cache results
        await updateConversationState(conversationId, {
          status: 'completed',
          similarUsers: result,
        });
      } catch (err) {
        // Handle timeout specifically
        if (err.name === 'AbortError') {
          console.error('Request timed out after 30 seconds');
          throw new Error('Request timed out. Please try again.');
        }
        throw err; // Re-throw for outer catch block
      }
    } catch (error) {
      console.error('Error processing conversation:', error);
      await updateConversationState(conversationId, { status: 'idle' });
    } finally {
      setIsLoading(false);
      // Reset processing flag
      isProcessingRef.current = false;
      console.log('Processing completed for:', conversationId);
    }
  }, [conversationId, messages, contentHash, setContentHash, setIsLoading, setIsProcessed, setSimilarUsers]);
}