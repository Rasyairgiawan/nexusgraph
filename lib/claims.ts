export type GapClaimStatus = 'exploring' | 'in_progress' | 'released';

export interface GapClaim {
  id: string;
  thesis_id: string;
  user_id: string;
  user_name: string;
  planned_angle: string;
  status: GapClaimStatus;
  claimed_at: string;
  expires_at: string | null;
}

export interface GapClaimWithMeta extends GapClaim {
  is_active: boolean;
  days_left: number | null;
}

const MS_PER_DAY = 86_400_000;

/**
 * A claim is active iff status !== 'released' AND
 * (status === 'in_progress' OR expires_at > now).
 */
export function isActiveClaim(
  claim: Pick<GapClaim, 'status' | 'expires_at'>,
  now: number = Date.now()
): boolean {
  if (claim.status === 'released') return false;
  if (claim.status === 'in_progress') return true;
  if (!claim.expires_at) return false;
  const expiresMs = new Date(claim.expires_at).getTime();
  return Number.isFinite(expiresMs) && expiresMs > now;
}

/**
 * Remaining whole days (>= 1) for active 'exploring' claims.
 * Returns null for 'in_progress', 'released', or expired claims.
 */
export function getDaysLeft(
  claim: Pick<GapClaim, 'status' | 'expires_at'>,
  now: number = Date.now()
): number | null {
  if (!isActiveClaim(claim, now)) return null;
  if (claim.status === 'in_progress' || !claim.expires_at) return null;
  const expiresAt = new Date(claim.expires_at).getTime();
  return Math.max(1, Math.ceil((expiresAt - now) / MS_PER_DAY));
}

export function formatExpiryLabel(daysLeft: number | null): string | null {
  if (daysLeft === null) return null;
  return `Expires in ${daysLeft}d`;
}

export function withClaimMeta(
  claim: GapClaim,
  now: number = Date.now()
): GapClaimWithMeta {
  return {
    ...claim,
    is_active: isActiveClaim(claim, now),
    days_left: getDaysLeft(claim, now),
  };
}

/**
 * Derives display status summary for a thesis from its claims list:
 * - 0 active claims -> "Available"
 * - >=1 active claims including 'in_progress' -> "In Progress (N)"
 * - >=1 active claims, all 'exploring' -> "Exploring (N)"
 */
export function getThesisGapSummary(
  claims: Array<Pick<GapClaim, 'status' | 'expires_at'>>,
  now: number = Date.now()
): string {
  const active = claims.filter((c) => isActiveClaim(c, now));
  if (active.length === 0) return 'Available';
  const hasInProgress = active.some((c) => c.status === 'in_progress');
  return hasInProgress
    ? `In Progress (${active.length})`
    : `Exploring (${active.length})`;
}

/**
 * Prevents duplicate active claim by the same user on the same thesis.
 */
export function hasActiveClaimByUser(
  claims: Array<Pick<GapClaim, 'user_id' | 'thesis_id' | 'status' | 'expires_at'>>,
  userId: string,
  thesisId: string,
  now: number = Date.now()
): boolean {
  if (!userId || !thesisId) return false;
  return claims.some(
    (c) =>
      c.user_id === userId &&
      c.thesis_id === thesisId &&
      isActiveClaim(c, now)
  );
}

export function getActiveClaimsForThesis<T extends GapClaim>(
  claims: T[],
  thesisId: string,
  now: number = Date.now()
): T[] {
  return claims.filter(
    (c) => c.thesis_id === thesisId && isActiveClaim(c, now)
  );
}

export function getActiveClaimsForUser<T extends GapClaim>(
  claims: T[],
  userId: string,
  now: number = Date.now()
): T[] {
  if (!userId) return [];
  return claims.filter(
    (c) => c.user_id === userId && isActiveClaim(c, now)
  );
}

