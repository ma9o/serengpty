import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from '../../app/app';
import '../../styles.css';

function main() {
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );

  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

export default main;