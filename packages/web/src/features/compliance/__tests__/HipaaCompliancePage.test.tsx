import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { HipaaCompliancePage } from '../HipaaCompliancePage.js';

describe('HipaaCompliancePage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <HipaaCompliancePage />
      </MemoryRouter>
    );
  }

  it('renders the hero heading "HIPAA-compliant by design."', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /HIPAA-compliant by design\./i, level: 1 })
    ).toBeInTheDocument();
  });

  it('does not use the prohibited phrase "HIPAA certified"', () => {
    renderPage();
    // The string "certified" must never appear on this page.
    expect(screen.queryByText(/HIPAA[\s-]?certified/i)).not.toBeInTheDocument();
  });

  it('renders the controls table with each Security Rule safeguard group', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /Administrative safeguards/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Technical safeguards/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Physical safeguards/i })
    ).toBeInTheDocument();
    // Use getAllByRole because "Privacy Rule controls" matches both the
    // safeguard group heading and may appear in body copy.
    expect(
      screen.getAllByRole('heading', { name: /Privacy Rule controls/i }).length
    ).toBeGreaterThan(0);
  });

  it('cites the relevant CFR sections', () => {
    renderPage();
    // CFR § 164.308 appears in both the lead paragraph and the
    // Administrative safeguards subhead, so use getAllByText.
    expect(screen.getAllByText(/45 CFR § 164\.308/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/45 CFR § 164\.312/i)).toBeInTheDocument();
    expect(screen.getByText(/45 CFR § 164\.310/i)).toBeInTheDocument();
  });

  it('includes expected control rows in the controls table', () => {
    renderPage();
    expect(screen.getByRole('cell', { name: /Workforce access management/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /Transmission security/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /Accounting of disclosures/i })).toBeInTheDocument();
  });

  it('publishes BAA, breach notification, and pending third-party attestation', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /Business Associate Agreement/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Breach notification/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Third-party attestation/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Third-party attestation: <pending>/i)).toBeInTheDocument();
  });
});
