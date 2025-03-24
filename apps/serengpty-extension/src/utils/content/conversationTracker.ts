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
// Stability tracking - time when the hash was last changed
let lastHashChangeTime = 0;
// Stability threshold in milliseconds (1 second)
const STABILITY_THRESHOLD = 1000;

/**
 * Forces immediate extraction and dispatch of conversation content
 * Used when responding to explicit requests for content from background script
 *
 * @param conversationId The ID of the conversation to extract content for
 */
export function forceContentExtraction(conversationId: string): void {
  if (!conversationId) return;

  // Extract the conversation from the DOM
  const messages = extractConversation();

  // No content to process
  if (messages.length === 0) {
    contentLogger.warn('Force extraction found no messages', {
      data: { conversationId },
    });
    return;
  }

  // Generate hash for this conversation
  const currentHash = hashConversation(messages);

  // Update last processed hash
  lastProcessedHash = currentHash;

  contentLogger.info('Force extracting conversation content', {
    data: {
      conversationId,
      messagesCount: messages.length,
      contentHash: currentHash,
    },
  });

  // Clear any existing debounce timer
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  // Send the content immediately (no debounce)
  dispatchConversationInitialContent({
    conversationId,
    messages,
    contentHash: currentHash,
  });
}

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

    // Update the time when the hash last changed
    lastHashChangeTime = Date.now();

    contentLogger.info('Conversation content changed', {
      data: {
        conversationId,
        messagesCount: messages.length,
        contentHash: currentHash,
      },
    });

    // Clear any existing timer
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    // Set a new debounce timer
    debounceTimer = setTimeout(() => {
      // Check if hash has been stable for STABILITY_THRESHOLD
      const timeElapsed = Date.now() - lastHashChangeTime;

      if (timeElapsed >= STABILITY_THRESHOLD) {
        contentLogger.info(
          'Conversation hash stabilized, dispatching content',
          {
            data: {
              conversationId,
              messagesCount: messages.length,
              contentHash: currentHash,
              stableFor: `${timeElapsed}ms`,
            },
          }
        );

        // Just notify about content change - leave processing decision to the provider
        dispatchConversationContent({
          conversationId,
          messages,
          contentHash: currentHash,
        });
      } else {
        contentLogger.info('Skipping dispatch, hash not stable yet', {
          data: {
            conversationId,
            timeElapsed: `${timeElapsed}ms`,
            requiredStability: `${STABILITY_THRESHOLD}ms`,
          },
        });
      }

      debounceTimer = null;
    }, STABILITY_THRESHOLD);
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
        contentHash: currentHash,
      },
    });

    // Send the initial state (force an update by using a different action)
    dispatchConversationInitialContent({
      conversationId,
      messages,
      contentHash: currentHash,
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
      data: { conversationId },
    });
  } else {
    contentLogger.warn('Could not find conversation container to observe', {
      data: { conversationId },
    });
  }

  // Return function to disconnect observer and clear any pending debounce
  return () => {
    observer.disconnect();
    contentLogger.info('Stopped observing conversation container', {
      data: { conversationId },
    });

    // Clear any pending debounce timer
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}
