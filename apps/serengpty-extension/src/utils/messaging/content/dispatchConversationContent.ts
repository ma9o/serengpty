import { Message } from '../../content/extractConversation';

/**
 * Dispatches a message indicating conversation content has changed
 */
export function dispatchConversationContent(
  conversationId: string,
  messages: Message[],
  contentHash: string
): void {
  browser.runtime.sendMessage({
    action: 'conversationContent',
    conversationId,
    messages,
    contentHash
  });
}