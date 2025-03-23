import { useCallback } from 'react';
import { Message, hashConversation } from '../../utils/content';
import { ProcessingMetadata } from './types';
import {
  conversationStatesStorage,
  updateConversationState,
  userDataStorage,
} from '../../utils/storage';
import { upsertConversation } from '../../services/api';

/**
 * Hook that returns a callback to process the current conversation
 */
export function useProcessConversation(
  conversationId: string | null,
  title: string | null,
  messages: Message[],
  contentHash: string | null,
  setContentHash: React.Dispatch<React.SetStateAction<string | null>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setSimilarUsers: React.Dispatch<React.SetStateAction<any[]>>,
  setProcessingMetadata: React.Dispatch<
    React.SetStateAction<ProcessingMetadata>
  >
) {
  // Create a ref to track if we're already processing
  const isProcessingRef = { current: false };

  return useCallback(
    async (forceRefresh = false) => {
      // Log when processing is initiated with detailed info
      console.log(
        'Processing initiated for:',
        conversationId,
        'Hash:',
        contentHash,
        'Force refresh:',
        forceRefresh
      );

      // Basic content validity checks
      if (!conversationId) {
        console.log('No conversation ID, skipping processing');
        return;
      }

      if (!title) {
        console.log('No title, skipping processing');
        return;
      }

      if (messages.length < 2) {
        console.log(
          'Not enough messages to process (need at least 2)',
          messages.length
        );
        return;
      }

      // Ensure last message is from assistant (complete pair)
      const lastMessageIsAssistant =
        messages[messages.length - 1].role === 'assistant';
      if (!lastMessageIsAssistant) {
        console.log('Last message is not from assistant, skipping processing');
        return;
      }

      const lastAssistantMessageHasContent =
        messages[messages.length - 1].content.length > 1; // HACK: there is some kind of start character
      if (!lastAssistantMessageHasContent) {
        console.log(
          'Last assistant message has no content, skipping processing'
        );
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

        console.log(
          `Processing conversation: ${conversationId} with title: ${
            title || 'not set'
          }`
        );

        // Check if we already have this content processed and not forcing refresh
        if (contentHash && !forceRefresh) {
          const states = await conversationStatesStorage.getValue();
          const state = states[conversationId];

          console.log(
            'State hash:',
            state?.contentHash,
            'Current hash:',
            contentHash,
            'Messages:',
            messages
          );

          const cacheIsValid =
            state?.contentHash === contentHash && state?.similarUsers;

          // Add time-based refresh (30 minutes cache validity)
          const cacheIsRecent = state?.lastProcessed
            ? new Date().getTime() - new Date(state.lastProcessed).getTime() <
              30 * 60 * 1000
            : false;

          console.log('Cache validation:', {
            cacheIsValid,
            cacheIsRecent,
            hashMatch: state?.contentHash === contentHash,
            hasSimilarUsers: !!state?.similarUsers,
            lastProcessedTime: state?.lastProcessed
              ? new Date(state?.lastProcessed).toISOString()
              : 'never',
          });

          if (cacheIsValid && cacheIsRecent) {
            // We have recent valid results, use them
            console.log('Using cached results (cache is valid and recent)');
            setSimilarUsers(state.similarUsers);
            // Important: Update processing metadata even when using cache
            setProcessingMetadata({
              lastProcessedHash: contentHash,
              lastProcessedAt: state.lastProcessed
                ? new Date(state.lastProcessed)
                : new Date(),
            });
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
        // Important: Do NOT update contentHash here before processing completes
        // This prevents premature cache hits
        const now = new Date();
        await updateConversationState(conversationId, {
          status: 'processing',
          lastProcessed: now.toISOString(),
          // No contentHash update here - only after successful processing
        });

        // Get user data
        const userData = await userDataStorage.getValue();
        if (!userData?.userId) {
          throw new Error('User not authenticated');
        }

        // Create API payload
        const contentString = JSON.stringify(messages);

        try {
          // Log the API call for debugging
          console.log(`Calling upsert-conversation API for ${conversationId}`);

          // Use the API service function
          const result = await upsertConversation({
            id: conversationId,
            title: title,
            userId: userData.userId,
            content: contentString,
          });

          // Update state
          setSimilarUsers(result);

          // Update processing metadata with new hash and timestamp
          setProcessingMetadata({
            lastProcessedHash: contentHash,
            lastProcessedAt: now,
          });

          // Cache results
          await updateConversationState(conversationId, {
            status: 'completed',
            contentHash: contentHash,
            similarUsers: result,
          });

          console.log(
            `Conversation ${conversationId} successfully processed with hash ${contentHash}`
          );
        } catch (err) {
          console.error('Error from API service:', err);
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
    },
    [
      conversationId,
      title,
      messages,
      contentHash,
      setContentHash,
      setIsLoading,
      setSimilarUsers,
      setProcessingMetadata,
    ]
  );
}
