import { OpenSidepanelMessage } from '../types';

/**
 * Handles requests to open the sidepanel
 */
export function handleOpenSidepanel(
  message: OpenSidepanelMessage,
  sender: browser.runtime.MessageSender
): void {
  if (!sender.tab?.id || !sender.tab?.windowId) {
    console.error('No tab or window id found');
    return;
  }

  browser.sidePanel.open({
    tabId: sender.tab.id,
    windowId: sender.tab.windowId,
  });
}