/**
 * Dispatches a message indicating navigation to a different conversation
 */
export function dispatchConversationNavigated(conversationId: string): void {
  browser.runtime.sendMessage({
    action: 'conversationNavigated',
    conversationId
  });
}