import { ConversationNavigatedMessage } from '../types';
import { dispatchConversationChanged } from './dispatchConversationChanged';
import { updateCurrentConversationState } from './handleGetSidepanelState';

/**
 * Handles conversation navigation events from content script
 */
export function handleConversationNavigated(
  message: ConversationNavigatedMessage
): void {
  const { conversationId, title } = message;
  
  console.log(`Background: User navigated to conversation ${conversationId}`);

  // Update cached state
  updateCurrentConversationState(conversationId, title);

  // Forward to sidepanel without messages (UI will fetch current state)
  dispatchConversationChanged(conversationId, undefined, undefined, title);
}