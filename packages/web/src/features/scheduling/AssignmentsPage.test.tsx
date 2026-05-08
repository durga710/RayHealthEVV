import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AssignmentsPage } from './AssignmentsPage.js';

describe('AssignmentsPage', () => {
  it('submits a coordinator assignment form', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: '123' })
    });
    global.fetch = mockFetch;

    render(<AssignmentsPage />);
    
    fireEvent.change(screen.getByLabelText('Client ID'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Caregiver ID'), { target: { value: 'caregiver-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Assignment' }));
    
    await waitFor(() => {
      expect(screen.getByText('Assignment created')).toBeInTheDocument();
    });
    
    expect(mockFetch).toHaveBeenCalled();
  });
});
