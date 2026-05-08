export function evaluateAssignmentEligibility(input) {
    if (!input.caregiverEligible) {
        throw new Error('Caregiver is not eligible for assignment');
    }
    if (input.visitDate < input.authorization.startDate || input.visitDate > input.authorization.endDate) {
        throw new Error('Visit date falls outside the authorization range');
    }
    return { eligible: true };
}
//# sourceMappingURL=assignment-eligibility-service.js.map