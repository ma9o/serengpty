import { mountButton } from '../utils/mountButton';

const watchPattern = new MatchPattern('*://chatgpt.com/c/*');

export default defineContentScript({
  matches: ['*://chatgpt.com/*'],
  main(ctx) {
    // Handle SPA navigation
    ctx.addEventListener(window, 'wxt:locationchange', async ({ newUrl }) => {
      if (watchPattern.includes(newUrl)) {
        const conversationId = newUrl.toString().split('/').pop();

        if (conversationId) {
          mountButton(conversationId);
        }
      }
    });
  },
});
