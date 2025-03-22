import { useEffect } from 'react';

/**
 * Hook to handle closing the sidepanel
 */
export function useHandleCloseSidepanel() {
  useEffect(() => {
    const listener = (message: { action: string }) => {
      if (message.action === 'closeSidePanel') {
        window.close();
      }
    };

    browser.runtime.onMessage.addListener(listener);

    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, []);
}