export interface CredentialPolicyInput {
  operatingTrack: 'personal-assistance' | 'home-health';
  credentials: { credentialType: string; status: string }[];
}

export interface CredentialPolicyResult {
  eligible: boolean;
  reasons: string[];
}

export function evaluateCredentialEligibility(input: CredentialPolicyInput): CredentialPolicyResult {
  const failingCredentials = input.credentials.filter((credential) => credential.status !== 'active');

  return {
    eligible: failingCredentials.length === 0,
    reasons: failingCredentials.map((credential) => credential.credentialType)
  };
}
