import { ConversationChangedMessage } from '../types';

/**
 * Handler type for conversation changed events
 */
export type ConversationChangedHandler = (message: ConversationChangedMessage) => void;

/**
 * Sets up a handler for conversation changed events
 * @param handler Function to call when conversation changes
 * @returns Cleanup function to remove the listener
 */
export function setupConversationChangedHandler(
  handler: ConversationChangedHandler
): () => void {
  const listener = (message: any) => {
    if (message.action === 'conversationChanged') {
      handler(message as ConversationChangedMessage);
    }
  };

  browser.runtime.onMessage.addListener(listener);

  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
}