import { extractConversation } from './extractConversation';
import { hashConversation } from './hashConversation';

// Keep track of the last processed conversation hash to avoid duplicate messages
let lastProcessedHash: string | null = null;

/**
 * Tracks changes to the current conversation and notifies the background script.
 * @param conversationId The ID of the current conversation
 */
export function trackConversation(conversationId: string): void {
  if (!conversationId) return;

  // Extract the conversation from the DOM
  const messages = extractConversation();

  // Only send if we have at least one complete message pair
  if (messages.length >= 2) {
    // Check if last message is from assistant (complete pair)
    const lastMessageIsAssistant =
      messages[messages.length - 1].role === 'assistant';

    if (lastMessageIsAssistant) {
      // Generate hash for this conversation
      const currentHash = hashConversation(messages);

      // Only send if the content has changed (different hash)
      if (currentHash !== lastProcessedHash) {
        lastProcessedHash = currentHash;

        // Send message to background script with conversation content
        browser.runtime.sendMessage({
          action: 'conversationChanged',
          conversationId,
          messages,
          contentHash: currentHash
        });
      }
    }
  }
}

/**
 * Observes changes to the DOM and tracks conversation updates
 * @param conversationId The ID of the current conversation
 * @returns A function to disconnect the observer
 */
export function observeConversation(conversationId: string): () => void {
  // Initial tracking
  trackConversation(conversationId);

  // Set up observer for DOM changes
  const observer = new MutationObserver(() => {
    trackConversation(conversationId);
  });

  // Start observing the main element that contains the conversation
  const conversationContainer = document.querySelector('main');
  if (conversationContainer) {
    observer.observe(conversationContainer, {
      childList: true,
      subtree: true,
    });
  }

  // Return function to disconnect observer
  return () => observer.disconnect();
}
