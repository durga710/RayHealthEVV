export const pennsylvaniaOperatingTracks = ['personal-assistance', 'home-health'] as const;
export const paCredentialTypes = ['tb-screening', 'background-check', 'license', 'training'] as const;
export const paCredentialStatuses = ['active', 'expired', 'pending'] as const;
export const paAssignmentStatuses = ['scheduled', 'completed', 'cancelled'] as const;
export const paExceptionTypes = ['late-clock-in', 'missing-location', 'telephony-fallback', 'manual-entry'] as const;
export const paCaregiverStatuses = ['active', 'inactive', 'suspended'] as const;

export type PaCredentialType = typeof paCredentialTypes[number];
export type PaExceptionType = typeof paExceptionTypes[number];

export type AppRole = 'admin' | 'coordinator' | 'caregiver' | 'family';

export type Capability =
  | 'agency.read' | 'agency.write'
  | 'staff.read' | 'staff.write'
  | 'client.read' | 'client.write'
  | 'schedule.read' | 'schedule.write'
  | 'evv.read' | 'evv.write'
  | 'auth.read' | 'auth.write'
  | 'audit.read' | 'audit.write';

const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
  admin: [
    'agency.read', 'agency.write',
    'staff.read', 'staff.write',
    'client.read', 'client.write',
    'schedule.read', 'schedule.write',
    'evv.read', 'evv.write',
    'auth.read', 'auth.write',
    'audit.read', 'audit.write'
  ],
  coordinator: [
    'agency.read',
    'staff.read',
    'client.read', 'client.write',
    'schedule.read', 'schedule.write',
    'evv.read'
  ],
  caregiver: [
    'schedule.read', 'evv.write'
  ],
  family: [
    'client.read',
    'schedule.read'
  ]
};

export function hasCapability(role: AppRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}
