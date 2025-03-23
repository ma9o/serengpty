import { ConversationChangedMessage, ExtensionMessage } from '../types';
import { sidepanelLogger } from '../../logger';

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
  const listener = (message: ExtensionMessage) => {
    if (message.action === 'conversationChanged') {
      sidepanelLogger.event('conversationChanged', 'Handling conversation change', message);
      handler(message as ConversationChangedMessage);
    }
  };

  browser.runtime.onMessage.addListener(listener);
  sidepanelLogger.debug('Registered conversation changed handler');

  return () => {
    browser.runtime.onMessage.removeListener(listener);
    sidepanelLogger.debug('Unregistered conversation changed handler');
  };
}