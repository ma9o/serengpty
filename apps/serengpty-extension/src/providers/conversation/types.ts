import { Message } from '../../utils/content';
import { SimilarUser } from '../../utils/storage';

// Define context types
export interface ConversationContextType {
  // State
  conversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  isProcessed: boolean;
  similarUsers: SimilarUser[];
  contentHash: string | null;
  
  // Methods
  processConversation: () => Promise<void>;
}

export interface ConversationMessageEvent {
  action: string;
  conversationId?: string;
  messages?: Message[];
  contentHash?: string;
}