import { createHash } from "node:crypto";

export type Persona = "logged-out" | "free" | "pro";
export type AuthenticatedPersona = Exclude<Persona, "logged-out">;

export type UsageLedgerSource = "model" | "hosted_tool" | "capability" | "infrastructure";

export interface UsageLedgerSeed {
  source: UsageLedgerSource;
  vendor: string;
  resource: string;
  unit: string;
  quantity: number;
  costMicros: number;
  credits: number;
  byok?: boolean;
  projectId?: string;
  workspaceId?: string;
}

export interface BillingSeed {
  period?: string;
  spentCredits?: number;
  reservedCredits?: number;
  overrunCredits?: number;
  overageCredits?: number;
  overageEnabled?: boolean;
  subscribed?: boolean;
  ledger?: UsageLedgerSeed[];
}

const PERSONA_ENDPOINT = "http://localhost:8787/__e2e-persona";

export function personaIdentity(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}

export function personaSessionToken(persona: AuthenticatedPersona, identity: string) {
  return `polychat-e2e-${persona}-${identity}`;
}

async function postPersona(body: Record<string, unknown>) {
  const response = await fetch(PERSONA_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`E2E persona setup failed with ${response.status}: ${await response.text()}`);
  }
}

export async function provisionLoggedOutPersona(seed: string, billing?: BillingSeed) {
  const identity = personaIdentity(seed);

  await postPersona({ identity, persona: "logged-out", billing: billing ?? null });

  return identity.slice(0, 36);
}

export async function provisionPersonaSession(
  persona: AuthenticatedPersona,
  seed: string,
  billing?: BillingSeed,
) {
  const identity = personaIdentity(seed);
  const sessionToken = personaSessionToken(persona, identity);

  await postPersona({ identity, persona, sessionToken, billing: billing ?? null });

  return {
    email: `${persona}-${identity}@e2e.polychat.invalid`,
    sessionToken,
  };
}

export async function reseedPersonaBilling(
  persona: Persona,
  seed: string,
  billing: BillingSeed,
): Promise<void> {
  if (persona === "logged-out") {
    await provisionLoggedOutPersona(seed, billing);

    return;
  }

  await provisionPersonaSession(persona, seed, billing);
}
