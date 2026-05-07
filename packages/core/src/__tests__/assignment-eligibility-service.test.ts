import { describe, expect, it } from 'vitest';
import { evaluateAssignmentEligibility } from '../services/assignment-eligibility-service.js';

describe('assignment eligibility service', () => {
  it('rejects assignment when authorization dates do not cover the visit', () => {
    expect(() =>
      evaluateAssignmentEligibility({
        authorization: { startDate: '2026-05-01', endDate: '2026-05-15' },
        visitDate: '2026-05-20',
        caregiverEligible: true
      })
    ).toThrow('authorization');
  });
});
