import { ExtensionMessage } from '../types';
import { handleConversationContent } from './handleConversationContent';
import { handleConversationInitialContent } from './handleConversationInitialContent';
import { handleConversationNavigated } from './handleConversationNavigated';
import { handleOpenSidepanel } from './handleOpenSidepanel';

/**
 * Sets up all message handlers for the background script
 * @returns A cleanup function to remove the listener
 */
export function setupMessageHandlers(): () => void {
  const listener = async (
    message: ExtensionMessage,
    sender: browser.runtime.MessageSender
  ) => {
    switch (message.action) {
      case 'conversationContent':
        await handleConversationContent(message);
        break;
      case 'conversationInitialContent':
        await handleConversationInitialContent(message);
        break;
      case 'conversationNavigated':
        handleConversationNavigated(message);
        break;
      case 'openSidepanel':
        handleOpenSidepanel(message, sender);
        break;
    }
  };

  browser.runtime.onMessage.addListener(listener);

  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
}