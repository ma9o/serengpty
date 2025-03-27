import { useCallback, useRef } from 'react'; // Import useRef
import { Message, hashConversation } from '../../utils/content';
import { ProcessingMetadata } from './types';
import {
  conversationStatesStorage,
  updateConversationState,
  userDataStorage,
  shouldProcessConversation, // Import the updated check
} from '../../utils/storage';
import { upsertConversation } from '../../services/api';
import { sidepanelLogger as logger } from '../../utils/logger'; // Use logger

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
  >,
  setProcessingError: React.Dispatch<React.SetStateAction<string | null>>
) {
  const isProcessingRef = useRef(false); // Use useRef to prevent race conditions

  return useCallback(
    async (forceRefresh = false) => {
      logger.info('Process conversation triggered', {
          data: { conversationId, contentHash, forceRefresh, isProcessing: isProcessingRef.current }
      });

      // --- Start: Improved Pre-checks ---
      if (!conversationId || !title || messages.length < 2) {
        logger.debug('Skipping processing: Missing ID, title, or sufficient messages.');
        return;
      }

      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role !== 'assistant' || !lastMessage?.content || lastMessage.content.length <= 1) {
        logger.debug('Skipping processing: Last message incomplete.');
        return;
      }

      // Ensure contentHash is calculated if null
      const currentHash = contentHash ?? hashConversation(messages);
      if (!contentHash) {
        logger.debug('Content hash was null, calculated new hash:', { data: { currentHash } });
        setContentHash(currentHash); // Update local state immediately
      }
      if (!currentHash) {
         logger.error('Skipping processing: Failed to get or calculate content hash.');
         return;
      }

      if (isProcessingRef.current) {
        logger.warn('Skipping processing: Another process is already running.');
        return;
      }

      // Check persistent state using shouldProcessConversation
      const shouldProcess = await shouldProcessConversation(conversationId, currentHash);
      if (!shouldProcess && !forceRefresh) {
        logger.info(`Skipping processing for ${conversationId}: Hash ${currentHash} already processed or errored.`);
        // Ensure loading state is false if we skip
        setIsLoading(false);
        return;
      }
      // --- End: Improved Pre-checks ---

      isProcessingRef.current = true;
      setIsLoading(true);
      const processingStartTime = new Date();
      logger.info(`Starting processing for ${conversationId}`, { data: { hash: currentHash, forceRefresh } });

      try {
        // Update persistent state to 'processing' *before* API call
        await updateConversationState(conversationId, {
          status: 'processing',
          lastProcessed: processingStartTime.toISOString(),
          contentHash: currentHash, // Store the hash we are attempting to process
          error: null // Clear previous error
        });

        // Update local metadata immediately (reflects the attempt)
        setProcessingMetadata({
            lastProcessedHash: currentHash,
            lastProcessedAt: processingStartTime
        });

        const userData = await userDataStorage.getValue();
        if (!userData?.userId || !userData?.extensionApiKey) {
          throw new Error('User not authenticated');
        }

        const contentString = JSON.stringify(messages);

        // --- API Call ---
        logger.debug(`Calling upsertConversation API for ${conversationId}`);
        const result = await upsertConversation({
          id: conversationId,
          title: title,
          apiKey: userData.extensionApiKey,
          content: contentString,
        });
        // --- Success ---
        logger.info(`Processing successful for ${conversationId}`, { data: { hash: currentHash, resultsCount: result.length } });

        setSimilarUsers(result);

        // Update persistent state to 'completed' on success
        await updateConversationState(conversationId, {
          status: 'completed',
          similarUsers: result,
          contentHash: currentHash, // Confirm the hash that succeeded
          lastProcessed: processingStartTime.toISOString(), // Keep the start time
          error: null
        });

         // Update local metadata on success (already set, but confirms hash)
         setProcessingMetadata({
            lastProcessedHash: currentHash,
            lastProcessedAt: processingStartTime,
            error: null
        });
        
        // Clear any previous error
        setProcessingError(null);

      } catch (error: any) {
        // --- Failure ---
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Processing failed for ${conversationId}`, {
            error, data: { hash: currentHash }
        });

        // Update persistent state to 'error' on failure
        await updateConversationState(conversationId, {
          status: 'error',
          error: errorMessage,
          contentHash: currentHash, // Store the hash that failed
          lastProcessed: processingStartTime.toISOString(), // Keep the attempt time
        });

         // Update local metadata to reflect error
         setProcessingMetadata({
            lastProcessedHash: currentHash, // Still record the hash that was attempted
            lastProcessedAt: processingStartTime,
            error: errorMessage
        });
        
        // Update the processing error in the context for display
        setProcessingError(errorMessage);

        // Optionally clear similar users on error, or keep stale data? Clearing is safer.
        setSimilarUsers([]);

      } finally {
        // --- Cleanup ---
        setIsLoading(false);
        isProcessingRef.current = false;
        logger.info(`Processing finished for ${conversationId}`, { data: { hash: currentHash } });
      }
    },
    [
      conversationId,
      title,
      messages, // Be cautious if messages is very large/changes frequently
      contentHash,
      setContentHash,
      setIsLoading,
      setSimilarUsers,
      setProcessingMetadata,
      setProcessingError,
      // No dependencies on state itself (like isLoading) to prevent loops
    ]
  );
}