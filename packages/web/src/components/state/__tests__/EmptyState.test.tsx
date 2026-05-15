import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { EmptyState } from '../EmptyState.js';

describe('EmptyState', () => {
  it('renders title, body, and an onClick CTA', () => {
    const handleClick = vi.fn();
    render(
      <MemoryRouter>
        <EmptyState
          title="No clients yet"
          body="Add one to get started."
          cta={{ label: 'Add a client', onClick: handleClick }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('No clients yet')).toBeInTheDocument();
    expect(screen.getByText('Add one to get started.')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Add a client' });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders a Link when cta.to is provided', () => {
    render(
      <MemoryRouter>
        <EmptyState title="No staff yet" cta={{ label: 'Invite', to: '/staff/invite' }} />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Invite' });
    expect(link).toHaveAttribute('href', '/staff/invite');
  });
});
