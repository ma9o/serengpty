import { useEffect, useState, useCallback } from 'react';

export function useCurrentConversation() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleConversationChanged = useCallback(() => {
    // setTimeout(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs.length === 0) {
        return;
      }

      const conversationId = tabs[0].url?.split('/').pop();
      //const conversationTitle = tabs[0].title;

      if (!conversationId) {
        return;
      }

      setConversationId(conversationId);
    });
    // }, 1000); // Wait for the title to load
  }, []);

  useEffect(() => {
    // Initialize the conversation when the hook is mounted
    handleConversationChanged();

    // Listen for messages from the content script
    browser.runtime.onMessage.addListener((message) => {
      if (message.action === 'conversationChanged') {
        handleConversationChanged();
      }
    });
  }, [handleConversationChanged]);

  return { conversationId, conversationTitle, isLoading };
}
