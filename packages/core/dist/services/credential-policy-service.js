export function evaluateCredentialEligibility(input) {
    const failingCredentials = input.credentials.filter((credential) => credential.status !== 'active');
    return {
        eligible: failingCredentials.length === 0,
        reasons: failingCredentials.map((credential) => credential.credentialType)
    };
}
//# sourceMappingURL=credential-policy-service.js.map