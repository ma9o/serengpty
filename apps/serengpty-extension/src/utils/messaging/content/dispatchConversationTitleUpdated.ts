/**
 * Dispatches a message when the conversation title has been updated
 */
export function dispatchConversationTitleUpdated(conversationId: string, title: string): void {
  browser.runtime.sendMessage({
    action: 'conversationTitleUpdated',
    conversationId,
    title
  });
}