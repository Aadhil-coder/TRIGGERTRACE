import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for PWA
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New content available.');
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline.');
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
