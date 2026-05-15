import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { LoadingSkeleton } from '../LoadingSkeleton.js';

describe('LoadingSkeleton', () => {
  it('renders the default 5 skeleton rows when no props are given', () => {
    render(<LoadingSkeleton />);
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(5);
  });

  it('renders the requested number of rows', () => {
    render(<LoadingSkeleton rows={7} columns={3} />);
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(7);
  });
});
