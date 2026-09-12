import { importHmacSecret, signJwt, verifyJwt } from "@ngriffin_uk/auth-jwt";
import {
  SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX,
  sandboxReviewBranchName,
  sandboxRepoSchema,
  type SandboxCredentialBrokerAccess,
  type SandboxDeliveryPolicy,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

const AUDIENCE = "assistant-sandbox-credential-broker";
const PURPOSE = "sandbox-credential-broker";
const MAX_TTL_SECONDS = 7_500;

const operationSchema = z.enum(["repository_read", "repository_write", "pull_request_write"]);

const claimsSchema = z
  .object({
    delivery_target_ref: z
      .string()
      .regex(/^refs\/heads\//)
      .optional(),
    exp: z.number().int().positive(),
    installation_id: z.number().int().positive(),
    operations: z.array(operationSchema),
    purpose: z.literal(PURPOSE),
    repo: sandboxRepoSchema,
    run_id: z.string().trim().min(1),
    sub: z.string().regex(/^\d+$/),
    write_refs: z.array(z.string().regex(/^refs\/heads\//)),
  })
  .passthrough();

export type SandboxCredentialBrokerOperation = z.infer<typeof operationSchema>;
export type SandboxCredentialBrokerClaims = z.infer<typeof claimsSchema>;

function signingSecret(env: Pick<IEnv, "JWT_SECRET">): string {
  const secret = env.JWT_SECRET?.trim();

  if (!secret) {
    throw new AssistantError(
      "Sandbox credential brokering is not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return secret;
}

function scopeForPolicy(
  policy: SandboxDeliveryPolicy,
  runId: string,
): {
  deliveryTargetRef?: string;
  operations: SandboxCredentialBrokerOperation[];
  writeRefs: string[];
} {
  const operations: SandboxCredentialBrokerOperation[] = ["repository_read"];
  const writeRefs: string[] = [];
  let deliveryTargetRef: string | undefined;

  if (policy.mode === "review_branch") {
    operations.push("repository_write");
    writeRefs.push(`refs/heads/${sandboxReviewBranchName(runId)}`);
  } else if (policy.mode === "commit_to_branch") {
    operations.push("repository_write");
    writeRefs.push(`refs/heads/${sandboxReviewBranchName(runId)}`);
    deliveryTargetRef = `refs/heads/${policy.targetBranch}`;
  }

  if (policy.mode === "review_branch" && policy.destination === "pull_request") {
    operations.push("pull_request_write");
  }

  return { deliveryTargetRef, operations, writeRefs };
}

export async function createSandboxCredentialBrokerAccess(params: {
  env: Pick<IEnv, "JWT_SECRET">;
  apiBaseUrl: string;
  deliveryPolicy: SandboxDeliveryPolicy;
  installationId: number;
  repo: string;
  runId: string;
  timeoutSeconds: number;
  userId: number;
}): Promise<SandboxCredentialBrokerAccess> {
  const now = Math.floor(Date.now() / 1_000);
  const expiresAt = now + Math.min(MAX_TTL_SECONDS, params.timeoutSeconds + 300);
  const scope = scopeForPolicy(params.deliveryPolicy, params.runId);
  const token = await signJwt(
    {
      aud: AUDIENCE,
      delivery_target_ref: scope.deliveryTargetRef,
      exp: expiresAt,
      iat: now,
      installation_id: params.installationId,
      iss: "assistant",
      jti: generateId(),
      operations: scope.operations,
      purpose: PURPOSE,
      repo: params.repo,
      run_id: params.runId,
      sub: String(params.userId),
      write_refs: scope.writeRefs,
    },
    {
      algorithm: "HS256",
      key: await importHmacSecret(signingSecret(params.env)),
    },
  );
  const baseUrl = new URL(
    `${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/${encodeURIComponent(params.runId)}`,
    params.apiBaseUrl,
  )
    .toString()
    .replace(/\/$/, "");

  return {
    baseUrl,
    expiresAt: new Date(expiresAt * 1_000).toISOString(),
    grant: token,
  };
}

export async function verifySandboxCredentialBrokerGrant(params: {
  env: Pick<IEnv, "JWT_SECRET">;
  grant: string;
  runId: string;
}): Promise<SandboxCredentialBrokerClaims> {
  let claims: unknown;

  try {
    claims = await verifyJwt(params.grant, {
      algorithms: ["HS256"],
      audience: AUDIENCE,
      issuer: "assistant",
      key: await importHmacSecret(signingSecret(params.env)),
      maxTokenAgeSeconds: MAX_TTL_SECONDS,
    });
  } catch (cause) {
    throw new AssistantError(
      "Invalid or expired sandbox credential broker grant",
      ErrorType.AUTHENTICATION_ERROR,
      401,
      { cause },
    );
  }

  const parsed = claimsSchema.safeParse(claims);

  if (!parsed.success || parsed.data.run_id !== params.runId) {
    throw new AssistantError(
      "Sandbox credential broker grant does not match this run",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return parsed.data;
}
