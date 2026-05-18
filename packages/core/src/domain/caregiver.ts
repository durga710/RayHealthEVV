import { z } from 'zod';
import { paCredentialTypes, paCredentialStatuses, paCaregiverStatuses } from '../config/pennsylvania.js';

export const caregiverSchema = z.object({
  id: z.string().uuid().optional(),
  agencyId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  npi: z.string().length(10).optional(),
  hireDate: z.string().date().optional(),
  status: z.enum(paCaregiverStatuses).default('active'),
});

export type Caregiver = z.infer<typeof caregiverSchema>;

export const caregiverCredentialSchema = z.object({
  id: z.string().uuid().optional(),
  caregiverId: z.string().uuid().or(z.string().min(1)),
  credentialType: z.enum(paCredentialTypes),
  status: z.enum(paCredentialStatuses).default('pending'),
  expiresAt: z.string().date(),
  issuedAt: z.string().date().optional(),
  notes: z.string().optional(),
});

export type CaregiverCredential = z.infer<typeof caregiverCredentialSchema>;

export const staffInviteSchema = z.object({
  id: z.string().uuid().optional(),
  agencyId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'coordinator', 'caregiver', 'family']),
  status: z.enum(['pending', 'accepted', 'expired']).default('pending'),
  invitedBy: z.string().uuid(),
  expiresAt: z.string().datetime(),
});

export type StaffInvite = z.infer<typeof staffInviteSchema>;
