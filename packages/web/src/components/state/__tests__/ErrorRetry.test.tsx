import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { ErrorRetry } from '../ErrorRetry.js';

describe('ErrorRetry', () => {
  it('calls onRetry when the Retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorRetry onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a custom message when provided', () => {
    render(<ErrorRetry message="Network down" onRetry={() => {}} />);
    expect(screen.getByText('Network down')).toBeInTheDocument();
  });
});
