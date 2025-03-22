import { mountButton } from '../utils/mountButton';
import { observeConversation } from '../utils/content/conversationTracker';
import { extractConversationId } from '../utils/extractConversationId';
import { dispatchConversationNavigated } from '../utils/messaging/content';

const watchPattern = new MatchPattern('*://chatgpt.com/c/*');

export default defineContentScript({
  matches: ['*://chatgpt.com/*'],
  main(ctx) {
    // Track active observers to disconnect them when needed
    let activeObserver: (() => void) | null = null;

    // Handle SPA navigation
    ctx.addEventListener(window, 'wxt:locationchange', async ({ newUrl }) => {
      // Disconnect previous observer if exists
      if (activeObserver) {
        activeObserver();
        activeObserver = null;
      }

      if (watchPattern.includes(newUrl)) {
        const conversationId = extractConversationId(newUrl);

        if (conversationId) {
          // Send a navigation event immediately when conversation changes
          dispatchConversationNavigated(conversationId);

          // Start observing the new conversation
          activeObserver = observeConversation(conversationId);

          // Mount the button for the sidepanel
          mountButton();
        }
      }
    });

    // Cleanup on content script unload
    return () => {
      if (activeObserver) {
        activeObserver();
      }
    };
  },
});
