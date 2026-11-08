import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/rubik';
import './index.css';
import App from './App';
import { consumeStartParam } from './state/startParams';

consumeStartParam();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
