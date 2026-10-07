import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA support
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    console.log('ServiceWorker registration failed: ', error);
    window.dispatchEvent(new Event('offline-package-error'));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);
