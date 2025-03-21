import { handleAuthentication } from '../utils/authentication';
import { handleOpenSidepanel } from '../utils/sidepanel';
import { updateConversationState, isActivatedConversation } from '../utils/storage';

export default defineBackground(() => {
  handleOpenSidepanel();
  handleAuthentication();

  // Listen for conversation changes and navigation
  browser.runtime.onMessage.addListener(async (message, sender) => {
    // Handle regular content updates
    if (message.action === 'conversationContent' && message.conversationId) {
      console.log(`Background: Received content update for ${message.conversationId}`);
      
      // Only update state if conversation is already activated
      const isActivated = await isActivatedConversation(message.conversationId);
      if (isActivated) {
        // Update the conversation state for future reference
        await updateConversationState(message.conversationId, { 
          contentHash: message.contentHash
        });
      }
      
      // Forward the content update to the sidepanel
      // This triggers UI update with new content
      browser.runtime.sendMessage({
        action: 'conversationChanged',
        conversationId: message.conversationId,
        messages: message.messages,
        contentHash: message.contentHash,
      });
    }
    
    // Handle initial content - same behavior but logged differently
    if (message.action === 'conversationInitialContent' && message.conversationId) {
      console.log(`Background: Received INITIAL content for ${message.conversationId}`);
      
      // Only update state if conversation is already activated
      const isActivated = await isActivatedConversation(message.conversationId);
      if (isActivated) {
        // Update the conversation state for future reference
        await updateConversationState(message.conversationId, { 
          contentHash: message.contentHash
        });
      }
      
      // Forward the content update to the sidepanel
      // This triggers UI update with new content
      browser.runtime.sendMessage({
        action: 'conversationChanged',
        conversationId: message.conversationId,
        messages: message.messages,
        contentHash: message.contentHash,
      });
    }

    // Handle navigation between conversations
    if (message.action === 'conversationNavigated' && message.conversationId) {
      console.log(`Background: User navigated to conversation ${message.conversationId}`);
      
      // Forward the navigation event to the sidepanel
      // This triggers UI update when switching conversations
      browser.runtime.sendMessage({
        action: 'conversationChanged',
        conversationId: message.conversationId,
        // Without messages, the UI will know to fetch current state
      });
    }
  });
});
