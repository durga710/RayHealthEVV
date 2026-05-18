import type { AppRole } from '../config/pennsylvania.js';

export interface User {
  id: string;
  agencyId: string;
  email: string;
  passwordHash: string;
  role: AppRole;
  caregiverId?: string;
}

export interface NewUser {
  agencyId: string;
  email: string;
  passwordHash: string;
  role: AppRole;
  caregiverId?: string;
}
