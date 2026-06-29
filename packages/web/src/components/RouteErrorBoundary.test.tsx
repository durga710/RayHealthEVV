import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { RouteErrorBoundary } from './RouteErrorBoundary.js';

function Boom() {
  throw new Error('kaboom');
  return null;
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    // The boundary logs the caught error; silence it so the test output is clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <RouteErrorBoundary>
        <p>healthy page</p>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('healthy page')).toBeInTheDocument();
  });

  it('shows a localized fallback instead of crashing when a child throws', () => {
    render(
      <RouteErrorBoundary>
        <Boom />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong on this page/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
  });
});
