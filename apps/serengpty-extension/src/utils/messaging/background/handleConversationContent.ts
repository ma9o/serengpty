import { ConversationContentMessage } from '../types';
import { isActivatedConversation } from '../../storage';
import { dispatchConversationChanged } from './dispatchConversationChanged';

/**
 * Handles conversation content updates from content script
 */
export async function handleConversationContent(
  message: ConversationContentMessage
): Promise<void> {
  const { conversationId, contentHash, messages } = message;
  
  console.log(`Background: Received content update for ${conversationId}`);

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
  dispatchConversationChanged(conversationId, messages, contentHash);
}