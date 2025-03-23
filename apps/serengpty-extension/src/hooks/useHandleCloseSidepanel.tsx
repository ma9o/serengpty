import { useEffect } from 'react';
import { ExtensionMessage } from '../utils/messaging/types';
import { sidepanelLogger } from '../utils/logger';

/**
 * Hook to handle closing the sidepanel
 */
export function useHandleCloseSidepanel() {
  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      if (message.action === 'closeSidePanel') {
        sidepanelLogger.event('closeSidePanel', 'Closing sidepanel');
        window.close();
      }
    };

    browser.runtime.onMessage.addListener(listener);

    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, []);
}