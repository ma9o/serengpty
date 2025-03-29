import { handleAuthentication } from '../utils/authentication';
import { setupMessageHandlers } from '../utils/messaging/background';
import { handleSidepanelActionClick } from '../utils/sidepanel';

export default defineBackground(() => {
  // Set up message handlers
  const cleanupMessageHandlers = setupMessageHandlers();

  // Handle authentication
  handleAuthentication();

  // Handle sidepanel action click
  handleSidepanelActionClick();

  // Return cleanup function
  return () => {
    cleanupMessageHandlers();
  };
});
