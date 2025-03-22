import { Message } from '../../content/extractConversation';

/**
 * Dispatches a message with the initial conversation content
 */
export function dispatchConversationInitialContent(
  conversationId: string,
  messages: Message[],
  contentHash: string
): void {
  browser.runtime.sendMessage({
    action: 'conversationInitialContent',
    conversationId,
    messages,
    contentHash
  });
}