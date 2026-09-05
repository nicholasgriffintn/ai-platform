import { importHmacSecret, signJwt, verifyJwt } from "@ngriffin_uk/auth-jwt";
import {
  SANDBOX_PREVIEW_ACCESS_TTL_SECONDS,
  SANDBOX_PREVIEW_BOOTSTRAP_TTL_SECONDS,
  SANDBOX_PREVIEW_GRANT_AUDIENCE,
  sandboxPreviewGrantClaimsSchema,
  type SandboxPreviewGrantClaims,
  type SandboxPreviewGrantPurpose,
} from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const SANDBOX_PREVIEW_EXPOSURE_TTL_SECONDS = 30;

interface PreviewGrantScope {
  expiresAt?: number;
  jti: string;
  originId: string;
  port: number;
  previewId: string;
  projectId: string;
  runId: string;
  serviceName: string;
  userId: number;
}

function signingSecret(env: IEnv): string {
  if (!env.JWT_SECRET?.trim()) {
    throw new AssistantError(
      "Sandbox preview signing is not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return env.JWT_SECRET.trim();
}

function ttlForPurpose(purpose: SandboxPreviewGrantPurpose): number {
  switch (purpose) {
    case "exposure":
      return SANDBOX_PREVIEW_EXPOSURE_TTL_SECONDS;
    case "bootstrap":
      return SANDBOX_PREVIEW_BOOTSTRAP_TTL_SECONDS;
    case "session":
      return SANDBOX_PREVIEW_ACCESS_TTL_SECONDS;
  }

  throw new Error("Unsupported sandbox preview grant purpose");
}

export async function createSandboxPreviewGrant(
  env: IEnv,
  purpose: SandboxPreviewGrantPurpose,
  scope: PreviewGrantScope,
): Promise<{ expiresAt: number; token: string }> {
  const now = Math.floor(Date.now() / 1_000);
  const expiresAt = scope.expiresAt ?? now + ttlForPurpose(purpose);
  const token = await signJwt(
    {
      aud: SANDBOX_PREVIEW_GRANT_AUDIENCE,
      exp: expiresAt,
      iat: now,
      iss: "assistant",
      jti: scope.jti,
      origin_id: scope.originId,
      port: scope.port,
      preview_id: scope.previewId,
      project_id: scope.projectId,
      purpose,
      run_id: scope.runId,
      service_name: scope.serviceName,
      sub: String(scope.userId),
    },
    {
      algorithm: "HS256",
      key: await importHmacSecret(signingSecret(env)),
    },
  );

  return { expiresAt, token };
}

export async function verifySandboxPreviewGrant(
  env: IEnv,
  token: string,
  purpose: SandboxPreviewGrantPurpose,
): Promise<SandboxPreviewGrantClaims> {
  let claims: unknown;

  try {
    claims = await verifyJwt(token, {
      algorithms: ["HS256"],
      audience: SANDBOX_PREVIEW_GRANT_AUDIENCE,
      issuer: "assistant",
      key: await importHmacSecret(signingSecret(env)),
      maxTokenAgeSeconds: ttlForPurpose(purpose),
    });
  } catch (cause) {
    throw new AssistantError(
      "Invalid or expired sandbox preview access",
      ErrorType.AUTHENTICATION_ERROR,
      401,
      { cause },
    );
  }

  const parsed = sandboxPreviewGrantClaimsSchema.safeParse(claims);

  if (!parsed.success || parsed.data.purpose !== purpose) {
    throw new AssistantError(
      "Sandbox preview access does not match this operation",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return parsed.data;
}
