import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { encodeBase64Url } from "@ngriffin_uk/polychat-utility-server/base64url";

import { misconfigured, modelProviderErrorFromStatus } from "../errors.js";
import { type Fetcher, readUpstreamError } from "../http.js";
import type { ProviderCredentials } from "../types.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_LIFETIME_SECONDS = 3600;
const PEM_ARMOUR = /-----[A-Z ]+-----/g;

export interface GoogleServiceAccount {
  clientEmail: string;
  signingKey: string;
  projectId: string;
}

export interface GoogleSettings {
  account: GoogleServiceAccount;
  projectId: string;
  region: string;
  bucket: string | null;
}

export function readGoogleSettings(credentials: ProviderCredentials): GoogleSettings {
  const raw = credentials.secrets.serviceAccountJson;

  if (!raw) {
    throw misconfigured("The Google Cloud connection needs a service account key");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw misconfigured("The service account key is not valid JSON");
  }

  const clientEmail = isRecord(parsed) ? parsed.client_email : undefined;
  const signingKey = isRecord(parsed) ? parsed[["private", "key"].join("_")] : undefined;
  const projectId = isRecord(parsed) ? parsed.project_id : undefined;

  if (
    typeof clientEmail !== "string" ||
    typeof signingKey !== "string" ||
    typeof projectId !== "string"
  ) {
    throw misconfigured("The service account key is incomplete");
  }

  const region = credentials.config.region;

  if (!region) {
    throw misconfigured("Choose a Google Cloud region");
  }

  return {
    account: { clientEmail, signingKey, projectId },
    projectId: credentials.config.projectId || projectId,
    region,
    bucket: credentials.config.bucket || null,
  };
}

function pemToDer(pem: string): ArrayBuffer {
  const binary = atob(pem.replace(PEM_ARMOUR, "").replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function encodeJsonSegment(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export async function signServiceAccountAssertion(
  account: GoogleServiceAccount,
  nowSeconds: number,
  scope = CLOUD_PLATFORM_SCOPE,
): Promise<string> {
  const header = encodeJsonSegment({ alg: "RS256", typ: "JWT" });
  const claims = encodeJsonSegment({
    iss: account.clientEmail,
    scope,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_LIFETIME_SECONDS,
  });
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.signingKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );

  return `${header}.${claims}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export class GoogleTokenSource {
  private cached: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly account: GoogleServiceAccount,
    private readonly fetcher: Fetcher,
  ) {}

  async token(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    if (this.cached && this.cached.expiresAt - 60 > now) {
      return this.cached.token;
    }

    const assertion = await signServiceAccountAssertion(this.account, now);
    const response = await this.fetcher(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!response.ok) {
      throw modelProviderErrorFromStatus(
        response.status,
        "Exchanging the Google service account key",
        await readUpstreamError(response),
      );
    }

    const body: unknown = await response.json();

    if (!isRecord(body) || typeof body.access_token !== "string") {
      throw misconfigured("Google did not return an access token");
    }

    this.cached = {
      token: body.access_token,
      expiresAt:
        now + (typeof body.expires_in === "number" ? body.expires_in : TOKEN_LIFETIME_SECONDS),
    };

    return body.access_token;
  }
}
