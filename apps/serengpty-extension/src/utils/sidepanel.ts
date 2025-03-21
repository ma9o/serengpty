export function handleOpenSidepanel() {
  // Listener for messages from the content script
  const listener = (message: any, sender: any, sendResponse: any) => {
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
  };
  
  browser.runtime.onMessage.addListener(listener);
  
  // Return cleanup function
  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
}

export function handleCloseSidepanel() {
  const listener = (message: any) => {
    // Might not be as easy if there are multiple side panels open
    if (message.action === 'closeSidePanel') {
      window.close();
    }
  };
  
  browser.runtime.onMessage.addListener(listener);
  
  // Return cleanup function
  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
}
