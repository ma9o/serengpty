import { signUp } from '../services/api';

export function handleAuthentication() {
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      console.log('Extension installed', details);

      try {
        // Check if user data is already stored
        const hasExistingData = await userDataStorage.getValue();

        if (!hasExistingData) {
          // Perform signup and get user credentials
          const userData = await signUp();

          // Save user data to extension storage
          await userDataStorage.setValue({
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
}
