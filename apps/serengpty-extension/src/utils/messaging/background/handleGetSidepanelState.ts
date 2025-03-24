import { GetSidepanelStateMessage } from '../types';
import { dispatchConversationChanged } from './';
import { backgroundLogger } from '../../logger';
import { createMessageHandler } from '../factory';
import { requestConversationContent } from './requestConversationContent';

// Maintain a cache of the current active conversation state
let currentConversationId: string | null = null;
let currentTitle: string | null = null;

/**
 * Handles a request for the current sidepanel state
 * Responds with the most recent conversation information
 */
export const handleGetSidepanelState = createMessageHandler<GetSidepanelStateMessage>(
  async (message) => {
    backgroundLogger.event('getSidepanelState', 'Handling getSidepanelState request');

    // If we have an active conversation, send it to the sidepanel
    if (currentConversationId) {
      // First inform the sidepanel about the conversation ID
      dispatchConversationChanged({
        conversationId: currentConversationId,
        title: currentTitle || undefined
      });
      
      // Then request content extraction from the content script
      // This ensures the content is sent to the sidepanel after it knows which conversation to display
      await requestConversationContent(currentConversationId);
      
      backgroundLogger.info('Requested content extraction for initial sidepanel load', {
        data: { conversationId: currentConversationId }
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
