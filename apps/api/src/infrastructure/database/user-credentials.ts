import type { UserCredential } from "./schema";

export interface Passkey {
  id: number;
  user_id: number;
  credential_id: string;
  public_key: JsonWebKey;
  counter: number;
  device_type: string;
  backed_up: boolean;
  transports: readonly AuthenticatorTransport[] | null;
  created_at: string;
  updated_at: string | null;
}

export function toPasskey(record: UserCredential): Passkey {
  if (
    record.kind !== "passkey" ||
    record.external_id === null ||
    record.public_key === null ||
    record.counter === null ||
    record.device_type === null ||
    record.backed_up === null
  ) {
    throw new Error("Invalid passkey credential record");
  }

  return {
    id: record.id,
    user_id: record.user_id,
    credential_id: record.external_id,
    public_key: record.public_key,
    counter: record.counter,
    device_type: record.device_type,
    backed_up: record.backed_up,
    transports: record.transports,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}
