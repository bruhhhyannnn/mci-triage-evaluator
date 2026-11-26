import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource-variable/figtree/wght-italic.css';
import '@fontsource-variable/spline-sans-mono/wght.css';
import App from './App';
import './styles/tokens.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
