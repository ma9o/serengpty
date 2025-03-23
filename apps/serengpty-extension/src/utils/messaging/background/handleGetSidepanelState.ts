import { GetSidepanelStateMessage } from '../types';
import { dispatchConversationChanged } from './dispatchConversationChanged';

// Maintain a cache of the current active conversation state
let currentConversationId: string | null = null;
let currentTitle: string | null = null;

/**
 * Handles a request for the current sidepanel state
 * Responds with the most recent conversation information
 */
export function handleGetSidepanelState(
  message: GetSidepanelStateMessage
): void {
  console.log('Background: Handling getSidepanelState request');

  // If we have an active conversation, send it to the sidepanel
  if (currentConversationId) {
    dispatchConversationChanged(
      currentConversationId,
      undefined,
      undefined,
      currentTitle || undefined
    );
  }
}

/**
 * Updates the cached conversation state when navigation or title updates occur
 */
export function updateCurrentConversationState(
  conversationId: string,
  title?: string
): void {
  currentConversationId = conversationId;

  // Only update title if provided, otherwise keep existing title
  if (title !== undefined) {
    currentTitle = title;
  }

  console.log(
    `Background: Updated current conversation state: ID=${conversationId}, Title=${
      title || 'not set'
    }`
  );
}
