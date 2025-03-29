// Import the handler from the new messaging architecture
import { backgroundLogger } from './logger';

export function handleSidepanelActionClick() {
  browser.action.onClicked.addListener(async (tab) => {
    backgroundLogger.info('Browser action icon clicked.', {
      data: { tabId: tab.id, windowId: tab.windowId },
    });

    // Ensure we have a window ID to associate the side panel with
    if (tab.windowId) {
      try {
        // Open the side panel for the current window
        await browser.sidePanel.open({ windowId: tab.windowId });
        backgroundLogger.info(
          'Successfully opened side panel via action click.'
        );
      } catch (error) {
        backgroundLogger.error('Failed to open side panel via action click.', {
          error: error as Error,
        });
      }
    } else {
      backgroundLogger.warn(
        'Cannot open side panel: windowId is missing from the tab object.'
      );
    }
  });
}
