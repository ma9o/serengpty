import { handleAuthentication } from '../utils/authentication';
import { setupMessageHandlers } from '../utils/messaging/background';

export default defineBackground(() => {
  // Set up message handlers
  const cleanupMessageHandlers = setupMessageHandlers();
  
  // Handle authentication
  handleAuthentication();

  // Return cleanup function
  return () => {
    cleanupMessageHandlers();
  };
});
