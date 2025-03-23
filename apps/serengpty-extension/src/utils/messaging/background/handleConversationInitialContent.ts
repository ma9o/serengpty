import { ConversationInitialContentMessage } from '../types';
import { isActivatedConversation } from '../../storage';
import { dispatchConversationChanged } from './';
import { backgroundLogger } from '../../logger';
import { createMessageHandler } from '../factory';

/**
 * Handles initial conversation content from content script
 */
export const handleConversationInitialContent = createMessageHandler<ConversationInitialContentMessage>(
  async (message) => {
    const { conversationId, contentHash, messages } = message;
    
    backgroundLogger.info(`Received initial content for conversation`, {
      data: {
        conversationId,
        messagesCount: messages.length,
        contentHash
      }
    });

    // Only initialize new conversations, but don't update contentHash
    // ContentHash should only be updated after processing, not when content changes
    const isActivated = await isActivatedConversation(conversationId);
    
    backgroundLogger.debug(`Activation status for conversation`, {
      data: { conversationId, isActivated }
    });
    
    // We don't update contentHash here anymore to avoid interfering with
    // the cache validation logic in the processing component

    // Forward to sidepanel
    dispatchConversationChanged({
      conversationId,
      messages,
      contentHash
    });
  },
  'background'
);