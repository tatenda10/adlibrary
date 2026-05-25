import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import AppToaster from './components/AppToaster.jsx';
import { BillingProvider } from './components/billing/BillingContext.jsx';
import { initTheme } from './lib/theme.js';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables.');
}

initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <BrowserRouter>
        <BillingProvider>
          <App />
          <AppToaster />
        </BillingProvider>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);
