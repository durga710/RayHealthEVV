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

    expect(await screen.findByText(/Pennsylvania Home Care Platform/i)).toBeInTheDocument();
    expect(screen.getByText(/Live visit command center/i)).toBeInTheDocument();
    expect(screen.getByText(/Implementation Roadmap/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Resource Library/i).length).toBeGreaterThan(0);
  });
});
