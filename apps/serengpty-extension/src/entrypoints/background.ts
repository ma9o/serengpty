import { signUp } from '../services/api';
import { saveUserData, hasUserData } from '../utils/storage';

export default defineBackground(() => {
  // Handle installation
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      console.log('Extension installed', details);

      try {
        // Check if user data is already stored
        const hasExistingData = await hasUserData();

        if (!hasExistingData) {
          // Perform signup and get user credentials
          const userData = await signUp();

          // Save user data to extension storage
          await saveUserData({
            userId: userData.userId,
            name: userData.name,
          });

          console.log('User registered successfully:', userData.name);
        } else {
          console.log('User data already exists, skipping signup');
        }
      } catch (error) {
        console.error('Failed to register user on installation:', error);
      }
    }
  });
});
