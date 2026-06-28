import type { AppRole } from '../config/pennsylvania.js';

export interface User {
  id: string;
  agencyId: string;
  email: string;
  passwordHash: string;
  role: AppRole;
  caregiverId?: string;
  /** ISO timestamp if the account has been suspended by the platform admin. */
  suspendedAt?: string | null;
  /** Owning agency's review gate: 'pending' | 'approved' | 'rejected'. */
  agencyReviewStatus?: string;
}

export interface NewUser {
  agencyId: string;
  email: string;
  passwordHash: string;
  role: AppRole;
  caregiverId?: string;
}
