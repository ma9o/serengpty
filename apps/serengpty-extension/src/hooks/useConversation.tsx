import { useEffect, useState, useCallback } from 'react';
import { Message } from '../utils/content/extractConversation';

interface Conversation {
  conversationId: string;
  messages: Message[];
}

interface ConversationMessage {
  action: string;
  conversationId?: string;
  messages?: Message[];
}

export function useConversation() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleConversationChanged = useCallback(
    (message: ConversationMessage) => {
      if (message.action === 'conversationChanged' && message.conversationId) {
        setConversation({
          conversationId: message.conversationId,
          messages: message.messages || [],
        });
      }
    },
    []
  );

  useEffect(() => {
    // Set up listener for messages from the content script
    browser.runtime.onMessage.addListener(handleConversationChanged);

    // When this component mounts, check if there's an active tab with a conversation
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs.length > 0 && tabs[0].url?.includes('chatgpt.com/c/')) {
        setIsLoading(true);
        const conversationId = tabs[0].url.split('/').pop();

        if (conversationId) {
          // We'll set just the ID for now, content will come from the message listener
          setConversation((prev) => ({
            conversationId,
            messages: prev?.messages || [],
          }));
        }
        setIsLoading(false);
      }
    });

    // Cleanup listener
    return () => {
      browser.runtime.onMessage.removeListener(handleConversationChanged);
    };
  }, [handleConversationChanged]);

  return {
    conversationId: conversation?.conversationId || null,
    messages: conversation?.messages || [],
    isLoading,
  };
}
