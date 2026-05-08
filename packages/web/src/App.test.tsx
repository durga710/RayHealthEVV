import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { AuthProvider } from './lib/AuthContext.js';

describe('admin app shell', () => {
  it('shows the landing page for unauthenticated users', () => {
    render(
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    );

    expect(screen.getByText(/Pennsylvania Home Care Platform/i)).toBeInTheDocument();
  });
});
