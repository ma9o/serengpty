import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import App from '../../app/app';
import '../../styles.css';

const main = {
  async mount() {
    // Wait for the DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', () => {
      const rootElement = document.getElementById('root');
      
      if (!rootElement) {
        console.error('Root element not found');
        return;
      }
      
      const root = createRoot(rootElement);
      
      root.render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    });
  }
};

export default main;