import { ConversationTitleUpdatedMessage } from '../types';
import { dispatchConversationChanged } from './';
import { updateCurrentConversationState } from './handleGetSidepanelState';
import { backgroundLogger } from '../../logger';
import { createMessageHandler } from '../factory';

/**
 * Handles conversation title update events from content script
 */
export const handleConversationTitleUpdated = createMessageHandler<ConversationTitleUpdatedMessage>(
  (message) => {
    const { conversationId, title } = message;
    
    backgroundLogger.info(`Conversation title updated`, {
      data: { conversationId, title }
    });

    // Update cached state
    updateCurrentConversationState(conversationId, title);

    // Forward to sidepanel with title information
    dispatchConversationChanged({
      conversationId, 
      title
    });
  },
  'background'
);