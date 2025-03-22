import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Message } from '../../utils/content';
import { SimilarUser, isActivatedConversation } from '../../utils/storage';
import { ConversationContextType, ProcessingMetadata } from './types';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useExtractMessages } from './hooks/useExtractMessages';
import { useProcessConversation } from './useProcessConversation';

// Create the context with a default value
const ConversationContext = createContext<ConversationContextType>({
  conversationId: null,
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
    setMessages,
    setIsLoading,
    setSimilarUsers,
    setContentHash,
    setProcessingMetadata
  );

  // Process the current conversation
  const processConversation = useProcessConversation(
    conversationId,
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

  // Set up listener for conversation change events
  useEffect(() => {
    browser.runtime.onMessage.addListener(handleMessage);

    // Check if there's an active conversation on initial load
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs.length > 0 && tabs[0].url?.includes('chatgpt.com/c/')) {
        const id = tabs[0].url.split('/').pop();
        if (id) {
          setConversationId(id);
        }
      }
    });

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, [handleMessage]);

  const value: ConversationContextType = {
    conversationId,
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
