import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SwitchPage } from './SwitchPage.js';

describe('SwitchPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <SwitchPage />
      </MemoryRouter>
    );
  }

  it('renders the hero heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /Switch without the scary part/i, level: 1 })
    ).toBeInTheDocument();
  });

  it('renders the four migration steps', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Export what you have/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /We map and import/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Run a parallel week/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Cut over clean/i })).toBeInTheDocument();
  });

  it('names no competitor anywhere on the page', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    // The page argues against ways of working, never against a named vendor.
    for (const vendor of ['HHAeXchange', 'WellSky', 'AxisCare', 'OneCare', 'StoriiCare', 'Alora', 'CareVoyant']) {
      expect(text).not.toContain(vendor);
    }
  });

  it('links the primary CTA to the demo page', () => {
    renderPage();
    const ctas = screen.getAllByRole('link', { name: /Book a migration call/i });
    expect(ctas.length).toBeGreaterThan(0);
    expect(ctas[0]).toHaveAttribute('href', '/demo');
  });
});
