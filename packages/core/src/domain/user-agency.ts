/**
 * A user's membership in one agency. A caregiver contracted at several
 * agencies has one membership row per agency, each carrying the role and
 * caregiver record that apply inside that agency.
 */
export interface UserAgencyMembership {
  userId: string;
  agencyId: string;
  agencyName: string;
  role: string;
  caregiverId?: string;
  status: string;
  /** Agency review gate (approved | pending | rejected); undefined on older snapshots. */
  agencyReviewStatus?: string;
}

export interface NewUserAgencyMembership {
  userId: string;
  agencyId: string;
  role: string;
  caregiverId?: string;
}
