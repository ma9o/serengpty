/**
 * Dispatches a message to close the sidepanel
 */
export function dispatchCloseSidepanel(): void {
  browser.runtime.sendMessage({
    action: 'closeSidePanel',
  });
}