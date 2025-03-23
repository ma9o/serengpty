import { GetSidepanelStateMessage } from '../types';
import { dispatchConversationChanged } from './';
import { backgroundLogger } from '../../logger';
import { createMessageHandler } from '../factory';

// Maintain a cache of the current active conversation state
let currentConversationId: string | null = null;
let currentTitle: string | null = null;

/**
 * Handles a request for the current sidepanel state
 * Responds with the most recent conversation information
 */
export const handleGetSidepanelState = createMessageHandler<GetSidepanelStateMessage>(
  (message) => {
    backgroundLogger.event('getSidepanelState', 'Handling getSidepanelState request');

    // If we have an active conversation, send it to the sidepanel
    if (currentConversationId) {
      dispatchConversationChanged({
        conversationId: currentConversationId,
        title: currentTitle || undefined
      });
    }
  },
  'background'
);

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

  backgroundLogger.info('Updated current conversation state', {
    data: {
      conversationId,
      title: title || 'not set'
    }
  });
}
