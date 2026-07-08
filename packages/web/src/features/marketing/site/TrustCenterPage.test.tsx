import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TrustCenterPage } from './TrustCenterPage.js';

describe('TrustCenterPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <TrustCenterPage />
      </MemoryRouter>
    );
  }

  it('renders the hero heading "RayHealthEVV Trust Center"', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /RayHealthEVV Trust Center/i, level: 1 })
    ).toBeInTheDocument();
  });

  it('renders all seven sections', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Current readiness status/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Security architecture/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /HIPAA operational readiness roadmap/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /AI and PHI policy/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Subprocessors/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Security contact/i })).toBeInTheDocument();
  });

  it('states operational HIPAA readiness is in progress and PHI must not be onboarded yet', () => {
    renderPage();
    expect(screen.getByText(/operational HIPAA readiness is in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/No real PHI should be onboarded yet\./i)).toBeInTheDocument();
  });

  it('does not use any forbidden compliance phrasing', () => {
    renderPage();
    expect(screen.queryByText(/HIPAA[\s-]?certified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fully HIPAA compliant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/guaranteed compliance/i)).not.toBeInTheDocument();
  });

  it('states admin assistant transcript text is not retained', () => {
    renderPage();
    expect(screen.getByText(/Admin-assistant transcript text is not retained/i)).toBeInTheDocument();
  });

  it('does not overstate who can edit the audit log', () => {
    renderPage();
    expect(screen.getByText(/the application cannot edit the log/i)).toBeInTheDocument();
    expect(screen.queryByText(/the log cannot be edited, even by us/i)).not.toBeInTheDocument();
  });

  it('mirrors PrivacyPage subprocessor BAA posture (Neon and AWS active, others in progress)', () => {
    renderPage();
    expect(screen.getByRole('cell', { name: /Neon/i })).toBeInTheDocument();
    // Vercel, Firebase, Resend remain in progress.
    expect(screen.getAllByText(/BAA in progress/i).length).toBeGreaterThan(0);
    // Neon + AWS are both active now.
    expect(screen.getAllByText(/BAA active/i).length).toBeGreaterThanOrEqual(2);
  });
});
