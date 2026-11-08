import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/rubik';
import './index.css';
import App from './App';
import { consumeStartParam } from './state/startParams';
import { SITE_ROOT } from './ui/links';

consumeStartParam();

// Service Worker (עבודה גם בלי רשת ועדכון אוטומטי) – יושב בשורש האתר
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${SITE_ROOT}sw.js`, { scope: SITE_ROOT }).catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
