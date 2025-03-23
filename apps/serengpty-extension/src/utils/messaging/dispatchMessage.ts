import { backgroundLogger, contentLogger, sidepanelLogger } from '../logger';
import { ExtensionMessage } from './types';

/**
 * Central function for dispatching messages with consistent logging
 */
export function dispatchMessage(
  message: ExtensionMessage,
  context: 'content' | 'background' | 'sidepanel' = 'content',
  target: 'runtime' | 'sidepanel' | 'tabs' = 'runtime',
  tabId?: number
): void {
  // Get appropriate logger
  const logger =
    context === 'content'
      ? contentLogger
      : context === 'background'
      ? backgroundLogger
      : sidepanelLogger;

  // Log the message dispatch with its action as the event type
  logger.event(
    message.action,
    `Dispatching ${message.action} message`,
    message
  );

  // Send message to appropriate target and catch any errors
  try {
    if (target === 'runtime') {
      browser.runtime.sendMessage(message).catch((error) => {
        logger.error(
          `Failed to dispatch ${message.action} message to runtime`,
          { error, data: message }
        );
      });
    } else if (target === 'sidepanel') {
      browser.runtime.sendMessage(message).catch((error) => {
        logger.error(
          `Failed to dispatch ${message.action} message to sidepanel`,
          { error, data: message }
        );
      });
    } else if (target === 'tabs' && tabId) {
      browser.tabs.sendMessage(tabId, message).catch((error) => {
        logger.error(
          `Failed to dispatch ${message.action} message to tab ${tabId}`,
          { error, data: message }
        );
      });
    }
  } catch (error) {
    logger.error(`Exception while dispatching ${message.action} message`, {
      error: error instanceof Error ? error : new Error(String(error)),
      data: { message, target, tabId },
    });
  }
}

/**
 * Function to create a properly typed dispatch wrapper for a specific message type
 */
export function createMessageDispatcher<T extends ExtensionMessage>(
  context: 'content' | 'background' | 'sidepanel',
  target: 'runtime' | 'sidepanel' | 'tabs' = 'runtime'
) {
  return (message: T, tabId?: number) => {
    dispatchMessage(message, context, target, tabId);
  };
}
