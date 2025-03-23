import { Message } from '../../utils/content';
import { SimilarUser } from '../../utils/storage';

// Processing metadata to replace binary isProcessed flag
export interface ProcessingMetadata {
  lastProcessedHash: string | null;
  lastProcessedAt: Date | null;
}

// Define context types
export interface ConversationContextType {
  // State
  conversationId: string | null;
  title: string | null;
  messages: Message[];
  isLoading: boolean;
  similarUsers: SimilarUser[];
  contentHash: string | null;
  processingMetadata: ProcessingMetadata;
  
  // Methods
  processConversation: (forceRefresh?: boolean) => Promise<void>;
}

// We're now using the types from utils/messaging/types.ts instead
// This is kept for backward compatibility
export interface ConversationMessageEvent {
  action: string;
  conversationId?: string;
  messages?: Message[];
  contentHash?: string;
}