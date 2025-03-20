const watchPattern = new MatchPattern('*://chatgpt.com/c/*');

export default defineContentScript({
  matches: ['*://chatgpt.com/*'],
  main(ctx) {
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      if (watchPattern.includes(newUrl))
        console.log('Conversation:', newUrl.toString().split('/').pop());
    });
  },
});
