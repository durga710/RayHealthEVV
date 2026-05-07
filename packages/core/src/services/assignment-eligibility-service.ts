export interface AssignmentEligibilityInput {
  authorization: { startDate: string; endDate: string };
  visitDate: string;
  caregiverEligible: boolean;
}

export interface AssignmentEligibilityResult {
  eligible: boolean;
}

export function evaluateAssignmentEligibility(input: AssignmentEligibilityInput): AssignmentEligibilityResult {
  if (!input.caregiverEligible) {
    throw new Error('Caregiver is not eligible for assignment');
  }

  if (input.visitDate < input.authorization.startDate || input.visitDate > input.authorization.endDate) {
    throw new Error('Visit date falls outside the authorization range');
  }

  return { eligible: true };
}
