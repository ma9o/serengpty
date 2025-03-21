import { useEffect, useState } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export function useExtractConversation(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedAt, setLastProcessedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    // Function to extract conversation from DOM
    const extractMessages = (): Message[] => {
      console.log('Extracting conversation content from DOM', document);

      try {
        // Get the first main element that contains the chat
        const mainElement = document.querySelector('main');
        if (!mainElement) return [];

        // Get all article elements (each represents a message)
        const articleElements = mainElement.querySelectorAll('article');
        if (!articleElements || articleElements.length === 0) return [];

        const messages: Message[] = [];

        // Process each article
        articleElements.forEach((article) => {
          try {
            let role: 'user' | 'assistant' = 'user'; // Default role
            let content = '';

            // Try to identify role from heading first
            const heading = article.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading) {
              const headingText = heading.textContent || '';
              if (
                headingText.includes('ChatGPT') ||
                headingText.includes('Assistant') ||
                headingText.includes('Claude')
              ) {
                role = 'assistant';
              } else if (headingText.includes('You')) {
                role = 'user';
              }
            }

            if (role === 'user') {
              // For user messages: find the first div with only whitespace-pre-wrap class
              const userContentDiv = Array.from(
                article.querySelectorAll('div')
              ).find((div) => {
                const classList = div.classList;
                return (
                  classList.length === 1 &&
                  classList.contains('whitespace-pre-wrap')
                );
              });

              if (userContentDiv) {
                content = userContentDiv.textContent || '';
              }
            } else {
              // For assistant messages: get text from content area
              // First try to find the main content div after the heading
              const assistantContentArea = heading
                ? heading.nextElementSibling
                : article.querySelector('div.markdown');

              if (assistantContentArea) {
                // Get all text content, excluding UI elements
                const uiElements =
                  assistantContentArea.querySelectorAll('button, svg');
                const clonedContent = assistantContentArea.cloneNode(
                  true
                ) as HTMLElement;

                // Remove UI elements from the clone
                uiElements.forEach((el) => {
                  const match = clonedContent.querySelector(`#${el.id}`);
                  if (match) match.remove();
                });

                content = clonedContent.textContent || '';
              }
            }

            // Only add message if we have content
            if (content.trim()) {
              messages.push({
                role,
                content: content.trim(),
                timestamp: new Date().toISOString(),
              });
            }
          } catch (articleError) {
            console.error('Error processing article:', articleError);
            // Continue to next article even if this one fails
          }
        });

        return messages;
      } catch (error) {
        console.error('Error extracting conversation:', error);
        return [];
      }
    };

    // Track previous message count to detect new messages
    let previousMessageCount = 0;

    // We'll observe DOM changes to detect conversation updates
    const observer = new MutationObserver((mutations) => {
      // Only process if we're not already processing
      if (isProcessing) return;

      // Extract current messages to check if there's anything new
      const currentMessages = extractMessages();

      // Only trigger processing if:
      // 1. We have more messages than before (new message added)
      // 2. The last message is from the assistant (a complete user+assistant pair)
      // 3. We haven't processed in the last 5 minutes (throttling)
      const hasNewMessages = currentMessages.length > previousMessageCount;
      const lastMessageIsAssistant =
        currentMessages.length > 0 &&
        currentMessages[currentMessages.length - 1].role === 'assistant';

      const timeThresholdMet =
        !lastProcessedAt ||
        new Date().getTime() - lastProcessedAt.getTime() > 5 * 60 * 1000;

      if (
        hasNewMessages &&
        lastMessageIsAssistant &&
        (timeThresholdMet || previousMessageCount === 0)
      ) {
        console.log('Processing new conversation content');
        setIsProcessing(true);
        setMessages(currentMessages);
        setLastProcessedAt(new Date());
        previousMessageCount = currentMessages.length;
        setIsProcessing(false);
      } else {
        // Update the previous count even if we don't process
        previousMessageCount = currentMessages.length;
      }
    });

    // Start observing the main element that contains the conversation
    const conversationContainer = document.querySelector('main');
    if (conversationContainer) {
      observer.observe(conversationContainer, {
        childList: true,
        subtree: true,
      });
    }

    // Initial extraction
    const initialMessages = extractMessages();
    previousMessageCount = initialMessages.length;

    // Only set messages if we have at least one complete user+assistant pair
    if (initialMessages.length >= 2) {
      // Check if the last message is from the assistant (complete pair)
      const lastMessageIsAssistant =
        initialMessages[initialMessages.length - 1].role === 'assistant';
      if (lastMessageIsAssistant) {
        setMessages(initialMessages);
        setLastProcessedAt(new Date());
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [conversationId, isProcessing, lastProcessedAt]);

  return { messages, isProcessing };
}
