import { ConversationTitleUpdatedMessage } from '../types';
import { dispatchConversationChanged } from './dispatchConversationChanged';
import { updateCurrentConversationState } from './handleGetSidepanelState';

/**
 * Handles conversation title update events from content script
 */
export function handleConversationTitleUpdated(
  message: ConversationTitleUpdatedMessage
): void {
  const { conversationId, title } = message;
  
  console.log(`Background: Conversation ${conversationId} title updated to "${title}"`);

  // Update cached state
  updateCurrentConversationState(conversationId, title);

  // Forward to sidepanel with title information
  dispatchConversationChanged(conversationId, undefined, undefined, title);
}