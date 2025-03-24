import { ExtensionMessage } from '../types';
import { contentLogger } from '../../logger';
import { handleRequestContentExtraction } from './handleRequestContentExtraction';

/**
 * Sets up all message handlers for the content script
 * @returns A cleanup function to remove the listener
 */
export function setupMessageHandlers(): () => void {
  const listener = (message: ExtensionMessage) => {
    contentLogger.event(message.action, `Received ${message.action} message`, message);

    switch (message.action) {
      case 'requestContentExtraction':
        handleRequestContentExtraction(message);
        break;
    }
  };

  browser.runtime.onMessage.addListener(listener);
  contentLogger.debug('Registered content script message handlers');

  return () => {
    browser.runtime.onMessage.removeListener(listener);
    contentLogger.debug('Unregistered content script message handlers');
  };
}