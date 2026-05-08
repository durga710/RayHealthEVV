import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';

describe('admin app shell', () => {
  it('shows the Pennsylvania admin navigation', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(screen.getByText('Agency Setup')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Assignments')).toBeInTheDocument();
  });
});
