import { Message } from '../../content/extractConversation';
import { dispatchMessage } from '../dispatchMessage';
import { ConversationContentMessage } from '../types';

/**
 * Dispatches a message indicating conversation content has changed
 */
export function dispatchConversationContent(
  conversationId: string,
  messages: Message[],
  contentHash: string
): void {
  const message: ConversationContentMessage = {
    action: 'conversationContent',
    conversationId,
    messages,
    contentHash,
  };
  
  dispatchMessage(message, 'content', 'runtime');
}
