import { ConversationContentMessage } from '../types';
import { updateConversationState, isActivatedConversation } from '../../storage';
import { dispatchConversationChanged } from './dispatchConversationChanged';

/**
 * Handles conversation content updates from content script
 */
export async function handleConversationContent(
  message: ConversationContentMessage
): Promise<void> {
  const { conversationId, contentHash, messages } = message;
  
  console.log(`Background: Received content update for ${conversationId}`);

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