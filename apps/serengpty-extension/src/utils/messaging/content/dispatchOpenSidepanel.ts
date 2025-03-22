/**
 * Dispatches a message to open the sidepanel
 */
export function dispatchOpenSidepanel(): void {
  browser.runtime.sendMessage({
    action: 'openSidepanel'
  });
}