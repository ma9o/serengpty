export function handleSidepanel() {
  // Listener for messages from the content script
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openSidepanel') {
      if (!sender.tab?.id || !sender.tab?.windowId) {
        console.error('No tab or window id found');
        return;
      }

      browser.sidePanel.open({
        tabId: sender.tab.id,
        windowId: sender.tab.windowId,
      });
    }
  });
}
