export interface CredentialPolicyInput {
    operatingTrack: 'personal-assistance' | 'home-health';
    credentials: {
        credentialType: string;
        status: string;
    }[];
}
export interface CredentialPolicyResult {
    eligible: boolean;
    reasons: string[];
}
export declare function evaluateCredentialEligibility(input: CredentialPolicyInput): CredentialPolicyResult;
//# sourceMappingURL=credential-policy-service.d.ts.map