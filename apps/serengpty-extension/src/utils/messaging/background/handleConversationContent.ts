import { ConversationContentMessage } from '../types';
import { isActivatedConversation } from '../../storage';
import { dispatchConversationChanged } from './';
import { backgroundLogger } from '../../logger';
import { createMessageHandler } from '../factory';

/**
 * Handles conversation content updates from content script
 */
export const handleConversationContent = createMessageHandler<ConversationContentMessage>(
  async (message) => {
    const { conversationId, contentHash, messages } = message;
    
    backgroundLogger.info(`Processing content update for conversation ${conversationId}`, {
      data: {
        isNew: false,
        messagesCount: messages.length,
        contentHashChanged: true // You would compute this from storage
      }
    });

    // Only initialize new conversations, but don't update contentHash
    // ContentHash should only be updated after processing, not when content changes
    const isActivated = await isActivatedConversation(conversationId);
    if (isActivated) {
      // We don't update contentHash here anymore to avoid interfering with
      // the cache validation logic in the processing component
      // This keeps the contentHash as "last processed" rather than "last seen"
      // await updateConversationState(conversationId, {
      //   contentHash: contentHash,
      // });
    }

    // Forward to sidepanel
    dispatchConversationChanged({
      conversationId,
      messages,
      contentHash
    });
  },
  'background'
);