import { backgroundLogger } from '../../logger';
import { dispatchRequestContentExtraction } from '../background';

/**
 * Sends a request to the content script in the active tab
 * to extract the current conversation content
 * 
 * @param conversationId The ID of the conversation to extract content for
 * @returns A promise that resolves when the message is sent
 */
export async function requestConversationContent(conversationId: string): Promise<void> {
  try {
    // Get the active tab in the current window
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    
    if (tabs.length === 0) {
      backgroundLogger.error('No active tab found when requesting content extraction');
      return;
    }
    
    const activeTab = tabs[0];
    
    // Make sure the tab has an ID
    if (!activeTab.id) {
      backgroundLogger.error('Active tab has no ID');
      return;
    }
    
    // Send message to the content script to extract conversation content
    await dispatchRequestContentExtraction({
      conversationId
    }, activeTab.id);
    
    backgroundLogger.info('Sent content extraction request to content script', {
      data: { tabId: activeTab.id, conversationId }
    });
  } catch (error) {
    backgroundLogger.error('Error requesting conversation content', {
      data: { error, conversationId }
    });
  }
}