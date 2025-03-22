export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Extracts the current conversation from the DOM
 * @returns Array of messages in the conversation
 */
export function extractConversation(): Message[] {
  const messages: Message[] = [];

  try {
    // Get the first main element that contains the chat
    const mainElement = document.querySelector('main');
    if (mainElement) {
      // Get all article elements (each represents a message)
      const articleElements = mainElement.querySelectorAll('article');
      if (articleElements && articleElements.length > 0) {
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
                // Clone the content area to avoid modifying the original DOM
                const clonedContent = assistantContentArea.cloneNode(
                  true
                ) as HTMLElement;

                // Remove UI elements from the clone
                const elementsToRemove =
                  clonedContent.querySelectorAll('button, svg');
                elementsToRemove.forEach((el) => el.remove());

                content = clonedContent.textContent || '';
              }
            }

            // Only add message if we have content
            if (content.trim()) {
              messages.push({
                role,
                content: content.trim(),
              });
            }
          } catch (articleError) {
            console.error('Error processing article:', articleError);
            // Continue to next article even if this one fails
          }
        });
      }
    }

    console.log('Extracted messages:', messages.length);

    return messages;
  } catch (error) {
    console.error('Error extracting conversation:', error);
    return messages;
  }
}
