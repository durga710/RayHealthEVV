import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { dropAuthenticatedEvents } from './lib/analytics.js';
import { App } from './App.js';
import { AuthProvider } from './lib/AuthContext.js';
import './index.css';

document.documentElement.dataset.appVersion = '2026.05.19';

// Dev-only contrast auditor. Static rules cannot see composed color , a
// gradient painted by a lower-specificity rule under a transparent element is
// invisible to them , so this walks the live DOM instead. Call
// window.__contrastAudit() in the console, or append ?contrast=1 to a route to
// outline every failing element. Tree-shaken out of production builds.
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
  void import('./lib/contrast-audit.js').then(({ installContrastAudit }) => installContrastAudit());
}

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
