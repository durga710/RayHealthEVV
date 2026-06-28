import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { AuthProvider } from './lib/AuthContext.js';

describe('admin app shell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Not authenticated' })
    }));
  });

  it('shows the landing page for unauthenticated users', async () => {
    render(
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    );

    // Hero h1 uses a <br />, so match by role to avoid text-node split issues.
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toBeInTheDocument();
    expect(h1).toHaveTextContent(/operating system/i);
    expect(h1).toHaveTextContent(/home-care/i);
    // Sign-in link(s) confirm the full marketing shell rendered.
    expect(screen.getAllByRole('link', { name: /sign in/i }).length).toBeGreaterThan(0);
    // A demo CTA confirms the conversion-focused shell rendered.
    expect(screen.getAllByRole('link', { name: /book a demo/i }).length).toBeGreaterThan(0);
  });
});
