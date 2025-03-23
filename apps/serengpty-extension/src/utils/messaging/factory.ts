import { ExtensionMessage } from './types';
import { dispatchMessage } from './dispatchMessage';

/**
 * Factory function to create message dispatcher functions
 * @param action The action identifier for the message
 * @param context The context from which the message is being dispatched
 * @param target The target to which the message should be sent
 * @returns A properly typed function to dispatch messages of this type
 */
export function createMessageDispatcher<T extends ExtensionMessage>(
  action: T['action'],
  context: 'content' | 'background' | 'sidepanel' = 'content',
  target: 'runtime' | 'sidepanel' | 'tabs' = 'runtime',
) {
  return (message: Omit<T, 'action'>, tabId?: number) => {
    const fullMessage = {
      ...message,
      action,
    } as T;
    
    dispatchMessage(fullMessage, context, target, tabId);
    return fullMessage;
  };
}

/**
 * Creates a message handler function that logs when messages are received
 * @param handler The function that handles the message
 * @param logger The logger to use
 * @returns A function that logs and handles the message
 */
export function createMessageHandler<T extends ExtensionMessage>(
  handler: (message: T, sender?: browser.runtime.MessageSender) => void | Promise<void>,
  context: 'background' | 'content' | 'sidepanel'
) {
  return async (message: T, sender?: browser.runtime.MessageSender) => {
    // Logging will already be done by the setupMessageHandlers function
    return handler(message, sender);
  };
}