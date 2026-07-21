import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComparePage } from './ComparePage.js';

describe('ComparePage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <ComparePage />
      </MemoryRouter>
    );
  }

  it('renders the hero heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /RayHealth vs\. the old way/i, level: 1 })
    ).toBeInTheDocument();
  });

  it('renders the comparison table with category columns, not vendor columns', () => {
    renderPage();
    expect(screen.getByRole('columnheader', { name: /Spreadsheets \+ payer portal/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Legacy agency platforms/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /RayHealth/i })).toBeInTheDocument();
  });

  it('covers the core capabilities', () => {
    renderPage();
    for (const capability of ['EVV capture', 'Claims', 'Remittances (835)', 'Denials', 'Audit preparation']) {
      expect(screen.getByRole('cell', { name: capability })).toBeInTheDocument();
    }
  });

  it('names no competitor anywhere on the page', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    for (const vendor of ['HHAeXchange', 'WellSky', 'AxisCare', 'OneCare', 'StoriiCare', 'Alora', 'CareVoyant']) {
      expect(text).not.toContain(vendor);
    }
  });

  it('links to the switching guide', () => {
    renderPage();
    const links = screen.getAllByRole('link', { name: /How switching works|Read the switching guide/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/switch');
  });
});
