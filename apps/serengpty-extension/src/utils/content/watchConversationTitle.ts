import { dispatchConversationTitleUpdated } from '../messaging/content';

const CHATGPT_DEFAULT_TITLE = 'ChatGPT';
const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 20; // 10 seconds max (20 * 500ms)
const STABILITY_COUNT = 3; // Stop after title is the same for 3 consecutive checks

/**
 * Watches for the ChatGPT page title to change from the default "ChatGPT" to the actual conversation title
 * 
 * @param conversationId The conversation ID to associate with the title
 * @returns A cleanup function to stop watching
 */
export function watchConversationTitle(conversationId: string): () => void {
  let attempts = 0;
  let lastCheckedTitle: string | null = null;
  let lastSentTitle: string | null = null;
  let stabilityCounter = 0;
  let intervalId: number | null = null;

  const checkTitle = () => {
    const currentTitle = document.title;
    
    // If title is still default and we've reached max attempts, stop polling
    if (currentTitle === CHATGPT_DEFAULT_TITLE) {
      if (++attempts >= MAX_POLL_ATTEMPTS) {
        console.log(`Failed to find conversation title after ${MAX_POLL_ATTEMPTS} attempts, stopping watcher`);
        clearInterval(intervalId!);
        intervalId = null;
        return;
      }
      return;
    }
    
    // Check if title changed since last check
    if (currentTitle !== lastCheckedTitle) {
      // Reset stability counter when title changes
      stabilityCounter = 0;
      
      // Send update if title is different from last sent
      if (currentTitle !== lastSentTitle) {
        console.log(`Conversation title changed: "${currentTitle}"`);
        lastSentTitle = currentTitle;
        dispatchConversationTitleUpdated(conversationId, currentTitle);
      }
    } else {
      // Title is stable (same as last check)
      stabilityCounter++;
      
      if (stabilityCounter >= STABILITY_COUNT) {
        console.log(`Conversation title "${currentTitle}" stable for ${STABILITY_COUNT} checks, stopping watcher`);
        clearInterval(intervalId!);
        intervalId = null;
        return;
      }
    }
    
    // Update last checked title
    lastCheckedTitle = currentTitle;
  };
  
  // Handle immediate title if already set
  const initialTitle = document.title;
  if (initialTitle !== CHATGPT_DEFAULT_TITLE) {
    lastCheckedTitle = initialTitle;
    lastSentTitle = initialTitle;
    dispatchConversationTitleUpdated(conversationId, initialTitle);
    console.log(`Initial title already set: "${initialTitle}"`);
    // Start stability counter at 1 since we already have one stable check
    stabilityCounter = 1;
  }
  
  intervalId = setInterval(checkTitle, POLL_INTERVAL_MS);

  // Return cleanup function
  return () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}