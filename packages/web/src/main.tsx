import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { dropAuthenticatedEvents } from './lib/analytics.js';
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
    {/*
      Vercel Analytics, public marketing pageviews only. Vercel is a
      subprocessor whose BAA is still in progress (see /privacy, /trust), so
      authenticated route paths, which carry entity identifiers like
      /admin/audit-packet/:visitId, must never reach it. `beforeSend` drops
      every event on an authenticated prefix, so no ID-bearing path is
      disclosed to a non-BAA vendor even after real PHI enters the system.
    */}
    <Analytics beforeSend={dropAuthenticatedEvents} />
  </React.StrictMode>
);
