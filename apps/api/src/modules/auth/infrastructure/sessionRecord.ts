import type { AuthSessionRecord } from "@ngriffin_uk/auth-core";

export interface StoredSessionRecord {
  readonly id: string;
  readonly userId: number;
  readonly expiresAt: string;
}

export function toAuthSessionRecord(
  record: StoredSessionRecord,
  sessionTtlMs: number,
): AuthSessionRecord {
  const expiresAt = new Date(record.expiresAt);

  return {
    tokenHash: record.id,
    userId: String(record.userId),
    createdAt: new Date(expiresAt.getTime() - sessionTtlMs),
    expiresAt,
  };
}
