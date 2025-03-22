import { useEffect } from 'react';
import { extractConversation, hashConversation } from '../../../utils/content';
import { ProcessingMetadata } from '../types';

/**
 * Hook to extract messages from the DOM and update state when they change
 */
export function useExtractMessages(
  conversationId: string | null,
  contentHash: string | null,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setContentHash: React.Dispatch<React.SetStateAction<string | null>>,
  setProcessingMetadata: React.Dispatch<React.SetStateAction<ProcessingMetadata>>
) {
  useEffect(() => {
    if (!conversationId) return;
    
    // Function to extract messages and update state
    const extractAndUpdateMessages = () => {
      const domMessages = extractConversation();
      if (domMessages.length > 0) {
        // Only update if content changed
        const newHash = hashConversation(domMessages);
        if (newHash !== contentHash) {
          // Log content change for debugging
          console.log('Content changed:', {
            oldMessageCount: domMessages.length,
            oldHash: contentHash,
            newHash
          });
          
          // Update messages and hash
          setMessages(domMessages);
          setContentHash(newHash);
          
          // Important: Reset processing metadata when content changes
          // This ensures the system knows this content hasn't been processed yet
          setProcessingMetadata(prevMetadata => {
            // Only reset if this is different from what we've already processed
            if (prevMetadata.lastProcessedHash !== newHash) {
              return {
                ...prevMetadata,
                lastProcessedHash: null
              };
            }
            return prevMetadata;
          });
        }
      }
    };
    
    // Extract initially with retry mechanism for slow-loading DOMs
    extractAndUpdateMessages();
    
    // Set a timeout to try again after DOM has time to fully load
    const initialExtractTimeout = setTimeout(() => {
      extractAndUpdateMessages();
    }, 500);
    
    // Set up observer for DOM changes
    const observer = new MutationObserver(() => {
      extractAndUpdateMessages();
    });
    
    // Start observing the main element
    const conversationContainer = document.querySelector('main');
    if (conversationContainer) {
      observer.observe(conversationContainer, {
        childList: true,
        subtree: true,
      });
    }
    
    return () => {
      clearTimeout(initialExtractTimeout);
      observer.disconnect();
    };
  }, [conversationId, contentHash, setMessages, setContentHash, setProcessingMetadata]);
}