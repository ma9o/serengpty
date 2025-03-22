import { ConversationInitialContentMessage } from '../types';
import { updateConversationState, isActivatedConversation } from '../../storage';
import { dispatchConversationChanged } from './dispatchConversationChanged';

/**
 * Handles initial conversation content from content script
 */
export async function handleConversationInitialContent(
  message: ConversationInitialContentMessage
): Promise<void> {
  const { conversationId, contentHash, messages } = message;
  
  console.log(`Background: Received INITIAL content for ${conversationId}`);

  // Only update state if conversation is already activated
  const isActivated = await isActivatedConversation(conversationId);
  if (isActivated) {
    await updateConversationState(conversationId, {
      contentHash: contentHash,
    });
  }

  // Forward to sidepanel
  dispatchConversationChanged(conversationId, messages, contentHash);
}