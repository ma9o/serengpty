import { extractConversation } from './extractConversation';
import { hashConversation } from './hashConversation';
import {
  dispatchConversationContent,
  dispatchConversationInitialContent,
} from '../messaging/content';
import { contentLogger } from '../logger';

// Keep track of the last processed conversation hash to avoid duplicate messages
let lastProcessedHash: string | null = null;
// Debounce timer for conversation content updates
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 500;

/**
 * Tracks changes to the current conversation and notifies the background script.
 * This function ONLY detects DOM changes and sends content updates.
 * The decision to upsert is made by ConversationProvider.
 * Includes debouncing to handle token-by-token updates in the chatgpt interface.
 *
 * @param conversationId The ID of the current conversation
 */
export function trackConversation(conversationId: string): void {
  if (!conversationId) return;

  // Extract the conversation from the DOM
  const messages = extractConversation();

  // No content to process
  if (messages.length === 0) return;

  // Generate hash for this conversation
  const currentHash = hashConversation(messages);

  // Only process if the content has changed (different hash)
  // This prevents spamming the background script with identical content
  if (currentHash !== lastProcessedHash) {
    // Store the new hash
    lastProcessedHash = currentHash;
    
    contentLogger.info('Conversation content changed', {
      data: {
        conversationId,
        messagesCount: messages.length,
        contentHash: currentHash
      }
    });

    // Clear any existing timer
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    // Set a new debounce timer
    debounceTimer = setTimeout(() => {
      // Just notify about content change - leave processing decision to the provider
      dispatchConversationContent({
        conversationId, 
        messages, 
        contentHash: currentHash
      });
      debounceTimer = null;
    }, DEBOUNCE_DELAY);
  }
}

/**
 * Observes changes to the DOM and tracks conversation updates
 * @param conversationId The ID of the current conversation
 * @returns A function to disconnect the observer
 */
export function observeConversation(conversationId: string): () => void {
  // Initial tracking - always send first state regardless of hash
  const messages = extractConversation();

  // Reset hash and force an immediate content update
  lastProcessedHash = null;

  // Send initial content if available
  if (messages.length > 0) {
    const currentHash = hashConversation(messages);
    lastProcessedHash = currentHash;

    contentLogger.info('Initial conversation content detected', {
      data: {
        conversationId,
        messagesCount: messages.length,
        contentHash: currentHash
      }
    });

    // Send the initial state (force an update by using a different action)
    dispatchConversationInitialContent({
      conversationId, 
      messages, 
      contentHash: currentHash
    });
  }

  // Set up observer for DOM changes (which will check for content changes)
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
    contentLogger.info('Started observing conversation container', {
      data: { conversationId }
    });
  } else {
    contentLogger.warn('Could not find conversation container to observe', {
      data: { conversationId }
    });
  }

  // Return function to disconnect observer and clear any pending debounce
  return () => {
    observer.disconnect();
    contentLogger.info('Stopped observing conversation container', {
      data: { conversationId }
    });

    // Clear any pending debounce timer
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}
