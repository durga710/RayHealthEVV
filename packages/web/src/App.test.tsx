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
    expect(h1).toHaveTextContent(/Home care, run like operations/i);
    // Log-in nav link confirms the full marketing shell rendered.
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    // Old hero copy must not be present.
    expect(screen.queryByText(/CARE\. VERIFIED\. DELIVERED/i)).not.toBeInTheDocument();
  });
});
