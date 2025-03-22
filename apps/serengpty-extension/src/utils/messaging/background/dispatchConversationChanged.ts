import { Message } from '../../content/extractConversation';

/**
 * Dispatches a message to the sidepanel when conversation changes
 */
export function dispatchConversationChanged(
  conversationId: string,
  messages?: Message[],
  contentHash?: string
): void {
  browser.runtime.sendMessage({
    action: 'conversationChanged',
    conversationId,
    ...(messages && { messages }),
    ...(contentHash && { contentHash }),
  });
}