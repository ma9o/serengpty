import { ConversationNavigatedMessage } from '../types';
import { dispatchConversationChanged } from './dispatchConversationChanged';

/**
 * Handles conversation navigation events from content script
 */
export function handleConversationNavigated(
  message: ConversationNavigatedMessage
): void {
  const { conversationId } = message;
  
  console.log(`Background: User navigated to conversation ${conversationId}`);

  // Forward to sidepanel without messages (UI will fetch current state)
  dispatchConversationChanged(conversationId);
}