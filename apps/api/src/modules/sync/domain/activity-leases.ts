import { DEVICE_SYNC_ACTIVITY_LEASE_TTL_MS } from "@ngriffin_uk/polychat-schemas";

export interface ActivityLease {
  scopes: string[];
  expiresAt: number;
}

export function renewActivityLease(
  requested: readonly string[],
  subscribed: readonly string[],
  now: number,
): ActivityLease | null {
  const allowed = new Set(subscribed);
  const scopes = [...new Set(requested)].filter((scope) => allowed.has(scope));

  return scopes.length > 0 ? { scopes, expiresAt: now + DEVICE_SYNC_ACTIVITY_LEASE_TTL_MS } : null;
}

export function isScopeWatched(
  leases: Iterable<ActivityLease | null | undefined>,
  scope: string,
  now: number,
): boolean {
  for (const lease of leases) {
    if (lease && lease.expiresAt > now && lease.scopes.includes(scope)) {
      return true;
    }
  }

  return false;
}
