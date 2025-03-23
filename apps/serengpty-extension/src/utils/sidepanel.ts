// Import the handler from the new messaging architecture
import { handleOpenSidepanel as handleOpenSidepanelFromBackground } from './messaging/background/handleOpenSidepanel';
import { backgroundLogger, sidepanelLogger } from './logger';

/**
 * @deprecated Use the functions from utils/messaging/background instead
 */
export function handleOpenSidepanel() {
  backgroundLogger.warn('Legacy handleOpenSidepanel called. Use the new messaging architecture instead.');
  // Listener for messages from the content script
  const listener = (message: any, sender: any, sendResponse: any) => {
    if (message.action === 'openSidepanel') {
      if (!sender.tab?.id || !sender.tab?.windowId) {
        backgroundLogger.error('Cannot open sidepanel', {
          error: new Error('No tab or window id found')
        });
        return;
      }

      backgroundLogger.info('Opening sidepanel (legacy handler)');
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

/**
 * @deprecated Use the functions from utils/messaging/sidepanel instead
 */
export function handleCloseSidepanel() {
  sidepanelLogger.warn('Legacy handleCloseSidepanel called. Use the new messaging architecture instead.');
  const listener = (message: any) => {
    // Might not be as easy if there are multiple side panels open
    if (message.action === 'closeSidePanel') {
      sidepanelLogger.info('Closing sidepanel (legacy handler)');
      window.close();
    }
  };

  browser.runtime.onMessage.addListener(listener);

  // Return cleanup function
  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
}