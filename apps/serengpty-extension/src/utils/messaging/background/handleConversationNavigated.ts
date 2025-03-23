import { ConversationNavigatedMessage } from '../types';
import { dispatchConversationChanged } from './';
import { updateCurrentConversationState } from './handleGetSidepanelState';
import { backgroundLogger } from '../../logger';
import { createMessageHandler } from '../factory';

/**
 * Handles conversation navigation events from content script
 */
export const handleConversationNavigated = createMessageHandler<ConversationNavigatedMessage>(
  (message) => {
    const { conversationId, title } = message;
    
    backgroundLogger.info(`User navigated to conversation`, {
      data: { conversationId, title }
    });

    // Update cached state
    updateCurrentConversationState(conversationId, title);

    // Forward to sidepanel without messages (UI will fetch current state)
    dispatchConversationChanged({
      conversationId, 
      title
    });
  },
  'background'
);