import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Message } from '../../utils/content';
import { SimilarUser } from '../../utils/storage';
import { ConversationContextType, ProcessingMetadata } from './types';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useExtractMessages } from './hooks/useExtractMessages';
import { useProcessConversation } from './useProcessConversation';
import { setupConversationChangedHandler } from '../../utils/messaging/sidepanel/handleConversationChanged';

// Create the context with a default value
const ConversationContext = createContext<ConversationContextType>({
  conversationId: null,
  title: null,
  messages: [],
  isLoading: false,
  similarUsers: [],
  contentHash: null,
  processingMetadata: {
    lastProcessedHash: null,
    lastProcessedAt: null,
  },

  processConversation: async (forceRefresh?: boolean) => {
    /* Default empty implementation */
  },
});

// Hook to use the conversation context
export const useConversation = () => useContext(ConversationContext);

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  // State
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [similarUsers, setSimilarUsers] = useState<SimilarUser[]>([]);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [processingMetadata, setProcessingMetadata] =
    useState<ProcessingMetadata>({
      lastProcessedHash: null,
      lastProcessedAt: null,
    });

  // Handle messages from background script
  const handleMessage = useMessageHandler(
    conversationId,
    setConversationId,
    setTitle,
    setMessages,
    setIsLoading,
    setSimilarUsers,
    setContentHash,
    setProcessingMetadata
  );

  // Process the current conversation
  const processConversation = useProcessConversation(
    conversationId,
    title,
    messages,
    contentHash,
    setContentHash,
    setIsLoading,
    setSimilarUsers,
    setProcessingMetadata
  );

  // Extract messages from DOM
  useExtractMessages(
    conversationId,
    contentHash,
    setMessages,
    setContentHash,
    setProcessingMetadata
  );

  // We'll keep the processing logic confined to the SimilarUsersTab component
  // to avoid duplication and excessive processing

  // Set up listener for conversation change events using the utility function
  useEffect(() => {
    // Use the dedicated handler utility from sidepanel messaging
    const cleanup = setupConversationChangedHandler(handleMessage);
    
    // When the sidepanel opens, check if there's a currently active conversation
    // by requesting the current state from the background script
    browser.runtime.sendMessage({ action: 'getSidepanelState' });
    
    return cleanup;
  }, [handleMessage]);

  const value: ConversationContextType = {
    conversationId,
    title,
    messages,
    isLoading,
    similarUsers,
    contentHash,
    processingMetadata,
    processConversation,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}
