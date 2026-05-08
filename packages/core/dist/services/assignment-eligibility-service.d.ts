export interface AssignmentEligibilityInput {
    authorization: {
        startDate: string;
        endDate: string;
    };
    visitDate: string;
    caregiverEligible: boolean;
}
export interface AssignmentEligibilityResult {
    eligible: boolean;
}
export declare function evaluateAssignmentEligibility(input: AssignmentEligibilityInput): AssignmentEligibilityResult;
//# sourceMappingURL=assignment-eligibility-service.d.ts.map