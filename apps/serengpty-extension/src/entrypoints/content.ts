import { mountButton } from '../utils/mountButton';
import { observeConversation } from '../utils/content/conversationTracker';
import { watchConversationTitle } from '../utils/content/watchConversationTitle';
import { extractConversationId } from '../utils/extractConversationId';
import { dispatchConversationNavigated } from '../utils/messaging/content';
import { contentLogger } from '../utils/logger';
import { setupMessageHandlers } from '../utils/messaging/content/setupMessageHandlers';

const watchPattern = new MatchPattern('*://chatgpt.com/c/*');
let firstTime = true;

export default defineContentScript({
  matches: ['*://chatgpt.com/*'],
  main(ctx) {
    contentLogger.info('Content script initialized', {
      data: { url: window.location.href },
    });

    // Track active observers to disconnect them when needed
    let activeObserver: (() => void) | null = null;
    let activeTitleWatcher: (() => void) | null = null;

    // Set up message handlers
    const cleanupMessageHandlers = setupMessageHandlers();

    // Handle SPA navigation
    ctx.addEventListener(window, 'wxt:locationchange', async ({ newUrl }) => {
      contentLogger.info('Location changed', {
        data: { url: newUrl, isConversation: watchPattern.includes(newUrl) },
      });

      // Disconnect previous observers if they exist
      if (activeObserver) {
        activeObserver();
        activeObserver = null;
      }

      if (activeTitleWatcher) {
        activeTitleWatcher();
        activeTitleWatcher = null;
      }

      if (watchPattern.includes(newUrl)) {
        const conversationId = extractConversationId(newUrl);

        if (conversationId) {
          // Send a navigation event immediately when conversation changes
          dispatchConversationNavigated({ conversationId });

          // Start observing the new conversation
          activeObserver = observeConversation(conversationId);

          // Start watching for the conversation title to change
          activeTitleWatcher = watchConversationTitle(conversationId);

          // Mount the button for the sidepanel
          mountButton(firstTime);
          firstTime = false;
        }
      }
    });

    // Cleanup on content script unload
    return () => {
      contentLogger.info('Content script unloaded');

      if (activeObserver) {
        activeObserver();
      }
      if (activeTitleWatcher) {
        activeTitleWatcher();
      }

      // Clean up message handlers
      cleanupMessageHandlers();
    };
  },
});
