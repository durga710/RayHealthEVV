import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { App } from './App.js';
import { AuthProvider } from './lib/AuthContext.js';
import './index.css';

document.documentElement.dataset.appVersion = '2026.05.19';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
    {/* Vercel Analytics — pageview pings only; no PHI in payload. */}
    <Analytics />
  </React.StrictMode>
);
