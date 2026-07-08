import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { HipaaCompliancePage } from './HipaaCompliancePage.js';

describe('HipaaCompliancePage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <HipaaCompliancePage />
      </MemoryRouter>
    );
  }

  it('renders the hero heading "Designed with HIPAA-grade controls."', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /Designed with HIPAA-grade controls\./i, level: 1 })
    ).toBeInTheDocument();
  });

  it('does not use prohibited finished-state compliance phrases', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/HIPAA[\s-]?certified/i);
    expect(text).not.toMatch(/fully HIPAA[\s-]?compliant/i);
    expect(text).not.toMatch(/guaranteed compliance/i);
    // "signs a BAA" (habitual present, zero executed BAAs) must be phrased
    // as the approved commitment form instead.
    expect(text).toMatch(/executes a BAA with every agency before any PHI is processed/i);
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
    expect(
      screen.getAllByRole('heading', { name: /Privacy Rule controls/i }).length
    ).toBeGreaterThan(0);
  });

  it('cites the relevant CFR sections', () => {
    renderPage();
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

  it('bounds audit-read wording to covered PHI operational reads and exports', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    expect(text).toMatch(/PHI-bearing operational reads and exports covered by the audit middleware/i);
    expect(text).not.toMatch(/Every read of PHI fields/i);
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
