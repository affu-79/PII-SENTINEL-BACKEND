import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Suppress MetaMask and browser extension errors
window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('MetaMask') || 
      event.error?.message?.includes('Failed to connect') ||
      event.filename?.includes('chrome-extension://') ||
      event.filename?.includes('moz-extension://')) {
    event.preventDefault();
    console.log('Suppressed browser extension error:', event.error?.message);
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('MetaMask') || 
      event.reason?.message?.includes('Failed to connect') ||
      event.reason?.stack?.includes('chrome-extension://') ||
      event.reason?.stack?.includes('moz-extension://')) {
    event.preventDefault();
    console.log('Suppressed browser extension promise rejection:', event.reason?.message);
    return false;
  }
});

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

if (!googleClientId) {
  console.warn(
    'Google OAuth client ID is not configured. Set REACT_APP_GOOGLE_CLIENT_ID to enable Google sign-in.'
  );
}

const AppWithProviders = googleClientId ? (
  <GoogleOAuthProvider clientId={googleClientId}>
    <App />
  </GoogleOAuthProvider>
) : (
  <App />
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>{AppWithProviders}</ErrorBoundary>
  </React.StrictMode>
);

