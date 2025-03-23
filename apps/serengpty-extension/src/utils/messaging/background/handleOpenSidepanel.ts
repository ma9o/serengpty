import { OpenSidepanelMessage } from '../types';
import { backgroundLogger } from '../../logger';
import { createMessageHandler } from '../factory';

/**
 * Handles requests to open the sidepanel
 */
export const handleOpenSidepanel = createMessageHandler<OpenSidepanelMessage>(
  (message, sender) => {
    if (!sender?.tab?.id || !sender.tab?.windowId) {
      backgroundLogger.error('Cannot open sidepanel', {
        error: new Error('No tab or window id found')
      });
      return;
    }

    backgroundLogger.info('Opening sidepanel', {
      data: {
        tabId: sender.tab.id,
        windowId: sender.tab.windowId
      }
    });

    browser.sidePanel.open({
      tabId: sender.tab.id,
      windowId: sender.tab.windowId,
    });
  },
  'background'
);