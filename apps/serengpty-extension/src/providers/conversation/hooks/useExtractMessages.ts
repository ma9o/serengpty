import { useEffect } from 'react';
import { extractConversation, hashConversation } from '../../../utils/content';

/**
 * Hook to extract messages from the DOM and update state when they change
 */
export function useExtractMessages(
  conversationId: string | null,
  contentHash: string | null,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setContentHash: React.Dispatch<React.SetStateAction<string | null>>
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
          setMessages(domMessages);
          setContentHash(newHash);
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
  }, [conversationId, contentHash, setMessages, setContentHash]);
}