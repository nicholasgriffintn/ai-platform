import {
  SANDBOX_PREVIEW_ACCESS_TTL_SECONDS,
  sandboxPreviewAuthorisationResponseSchema,
  sandboxPreviewExposureResponseSchema,
  type SandboxPreviewAccess,
  type SandboxPreviewAuthorisationRequest,
  type SandboxPreviewAuthorisationResponse,
  type SandboxPreviewGrantClaims,
  type SandboxPreviewSessionRecord,
  type SandboxPreviewState,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId, randomHex } from "~/utils/id";

import { createSandboxPreviewGrant, verifySandboxPreviewGrant } from "./preview-grants";
import { resolvePreviewServiceState } from "./preview-service-state";
import {
  consumeRunCoordinatorPreviewSession,
  createRunCoordinatorPreviewSession,
  getRunCoordinatorPreviewSession,
  listRunCoordinatorEvents,
  revokeRunCoordinatorPreviewSession,
} from "./run-coordinator/client";
import { getSandboxRunRecordForUser } from "./runs";

function previewHost(env: IEnv): string {
  const value = env.SANDBOX_PREVIEW_HOST?.trim();

  if (!value) {
    throw new AssistantError("Sandbox previews are not configured", ErrorType.CONFIGURATION_ERROR);
  }

  let parsed: URL;

  try {
    parsed = new URL(`${env.ENV === "development" ? "http" : "https"}://${value}`);
  } catch {
    throw new AssistantError(
      "Sandbox preview host is not configured correctly",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  if (parsed.host !== value || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new AssistantError(
      "Sandbox preview host is not configured correctly",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return value;
}

function previewOrigin(env: IEnv, originId: string): string {
  const protocol = env.ENV === "development" ? "http" : "https";

  return `${protocol}://${originId}.${previewHost(env)}`;
}

function isTerminal(status: string): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

async function currentServiceState(env: IEnv, runId: string, serviceName: string) {
  const events = await listRunCoordinatorEvents({ env, runId });

  return resolvePreviewServiceState(
    events.map((envelope) => envelope.event),
    serviceName,
  );
}

function previewState(params: {
  runStatus: string;
  serviceStatus?: string;
  expiresAt: string;
  revokedAt?: string;
}): SandboxPreviewState {
  if (Date.parse(params.expiresAt) <= Date.now()) {
    return "expired";
  }

  if (params.revokedAt || isTerminal(params.runStatus) || params.serviceStatus === "stopped") {
    return "stopped";
  }

  if (params.serviceStatus === "healthy") {
    return "healthy";
  }

  if (params.serviceStatus === "starting" || params.serviceStatus === "restarting") {
    return "starting";
  }

  return "unhealthy";
}

function assertSessionMatchesClaims(
  session: SandboxPreviewSessionRecord,
  claims: SandboxPreviewGrantClaims,
): void {
  if (
    session.previewId !== claims.preview_id ||
    session.originId !== claims.origin_id ||
    session.userId !== Number(claims.sub) ||
    session.projectId !== claims.project_id ||
    session.serviceName !== claims.service_name ||
    session.port !== claims.port
  ) {
    throw new AssistantError(
      "Sandbox preview access does not match this session",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }
}

async function currentAuthorisedPreview(params: {
  claims: SandboxPreviewGrantClaims;
  env: IEnv;
}): Promise<{
  session: SandboxPreviewSessionRecord;
}> {
  const userId = Number(params.claims.sub);
  const baseContext = createServiceContext({ env: params.env });
  const user = await baseContext.repositories.users.getUserById(userId);

  if (!user) {
    throw new AssistantError("Sandbox preview is unavailable", ErrorType.NOT_FOUND, 404);
  }

  const context = createServiceContext({ env: params.env, user });
  const run = await getSandboxRunRecordForUser({
    context,
    userId,
    runId: params.claims.run_id,
  });

  if (!run.projectId || run.projectId !== params.claims.project_id) {
    throw new AssistantError("Sandbox preview is unavailable", ErrorType.NOT_FOUND, 404);
  }

  const session = await getRunCoordinatorPreviewSession({
    env: params.env,
    previewId: params.claims.preview_id,
    runId: params.claims.run_id,
  });

  if (!session) {
    throw new AssistantError("Sandbox preview is unavailable", ErrorType.NOT_FOUND, 404);
  }

  assertSessionMatchesClaims(session, params.claims);

  const service = await currentServiceState(
    params.env,
    params.claims.run_id,
    params.claims.service_name,
  );
  const state = previewState({
    runStatus: run.run.status,
    serviceStatus: service?.status,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
  });

  if (state !== "healthy" || service?.port !== session.port) {
    await revokeRunCoordinatorPreviewSession({
      env: params.env,
      previewId: session.previewId,
      runId: params.claims.run_id,
    });

    throw new AssistantError(
      state === "expired" ? "Sandbox preview expired" : "Sandbox preview is unavailable",
      state === "expired" ? ErrorType.AUTHENTICATION_ERROR : ErrorType.CONFLICT_ERROR,
      state === "expired" ? 410 : 409,
    );
  }

  return { session };
}

export async function createSandboxPreview(params: {
  context: ServiceContext;
  runId: string;
  serviceName: string;
  userId: number;
}): Promise<SandboxPreviewAccess> {
  const run = await getSandboxRunRecordForUser({
    context: params.context,
    userId: params.userId,
    runId: params.runId,
  });

  if (!run.projectId || isTerminal(run.run.status)) {
    throw new AssistantError("Sandbox run is not previewable", ErrorType.CONFLICT_ERROR, 409);
  }

  const service = await currentServiceState(params.context.env, params.runId, params.serviceName);

  if (service?.status !== "healthy" || service.port === undefined) {
    throw new AssistantError("Declared service is not healthy", ErrorType.CONFLICT_ERROR, 409);
  }

  if (!params.context.env.SANDBOX_WORKER) {
    throw new AssistantError("Sandbox worker not available", ErrorType.CONFIGURATION_ERROR);
  }

  const previewId = generateId();
  const originId = randomHex(24).toLowerCase();
  const bootstrapJti = generateId();
  const sessionJti = generateId();
  const expiresAtSeconds = Math.floor(Date.now() / 1_000) + SANDBOX_PREVIEW_ACCESS_TTL_SECONDS;
  const exposure = await createSandboxPreviewGrant(params.context.env, "exposure", {
    jti: generateId(),
    originId,
    port: service.port,
    previewId,
    projectId: run.projectId,
    runId: params.runId,
    serviceName: params.serviceName,
    userId: params.userId,
  });
  const exposureResponse = await params.context.env.SANDBOX_WORKER.fetch(
    new Request("http://sandbox/preview/expose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant: exposure.token }),
    }),
  );

  if (!exposureResponse.ok) {
    throw new AssistantError(
      "Sandbox service could not be exposed safely",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const parsedExposure = sandboxPreviewExposureResponseSchema.safeParse(
    await exposureResponse.json().catch(() => undefined),
  );

  if (!parsedExposure.success) {
    throw new AssistantError(
      "Sandbox preview exposure response was invalid",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const session: SandboxPreviewSessionRecord = {
    previewId,
    originId,
    userId: params.userId,
    projectId: run.projectId,
    serviceName: params.serviceName,
    port: service.port,
    forwardToken: parsedExposure.data.forwardToken,
    bootstrapJti,
    sessionJti,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(expiresAtSeconds * 1_000).toISOString(),
  };
  const stored = await createRunCoordinatorPreviewSession({
    env: params.context.env,
    runId: params.runId,
    session,
  });

  if (!stored) {
    throw new AssistantError(
      "Sandbox preview session could not be stored",
      ErrorType.STORAGE_ERROR,
    );
  }

  const bootstrap = await createSandboxPreviewGrant(params.context.env, "bootstrap", {
    jti: bootstrapJti,
    originId,
    port: session.port,
    previewId,
    projectId: session.projectId,
    runId: params.runId,
    serviceName: session.serviceName,
    userId: session.userId,
  });
  const url = new URL("/__polychat/preview/open", previewOrigin(params.context.env, originId));

  url.searchParams.set("grant", bootstrap.token);

  return {
    previewId,
    runId: params.runId,
    serviceName: params.serviceName,
    state: "healthy",
    expiresAt: session.expiresAt,
    url: url.toString(),
  };
}

export async function getSandboxPreview(params: {
  context: ServiceContext;
  previewId: string;
  runId: string;
  userId: number;
}): Promise<SandboxPreviewAccess> {
  const run = await getSandboxRunRecordForUser({
    context: params.context,
    userId: params.userId,
    runId: params.runId,
  });
  const session = await getRunCoordinatorPreviewSession({
    env: params.context.env,
    previewId: params.previewId,
    runId: params.runId,
  });

  if (!session || session.userId !== params.userId || session.projectId !== run.projectId) {
    throw new AssistantError("Sandbox preview not found", ErrorType.NOT_FOUND, 404);
  }

  const service = await currentServiceState(params.context.env, params.runId, session.serviceName);

  return {
    previewId: session.previewId,
    runId: params.runId,
    serviceName: session.serviceName,
    state: previewState({
      runStatus: run.run.status,
      serviceStatus: service?.status,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    }),
    expiresAt: session.expiresAt,
  };
}

export async function revokeSandboxPreview(params: {
  context: ServiceContext;
  previewId: string;
  runId: string;
  userId: number;
}): Promise<void> {
  await getSandboxPreview(params);
  await revokeRunCoordinatorPreviewSession({
    env: params.context.env,
    previewId: params.previewId,
    runId: params.runId,
  });
}

export async function authoriseSandboxPreview(params: {
  env: IEnv;
  request: SandboxPreviewAuthorisationRequest;
}): Promise<SandboxPreviewAuthorisationResponse> {
  const purpose = params.request.mode === "bootstrap" ? "bootstrap" : "session";
  const claims = await verifySandboxPreviewGrant(params.env, params.request.credential, purpose);

  if (claims.origin_id !== params.request.originId) {
    throw new AssistantError(
      "Sandbox preview access does not match this origin",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const authorised = await currentAuthorisedPreview({ claims, env: params.env });
  let sessionToken: string | undefined;

  if (purpose === "bootstrap") {
    const consumed = await consumeRunCoordinatorPreviewSession({
      bootstrapJti: claims.jti,
      env: params.env,
      previewId: claims.preview_id,
      runId: claims.run_id,
    });

    if (consumed.ok === false) {
      throw new AssistantError(
        "Sandbox preview access denied",
        consumed.status === 409 ? ErrorType.CONFLICT_ERROR : ErrorType.AUTHENTICATION_ERROR,
        consumed.status === 409 ? 409 : 401,
      );
    }

    const sessionGrant = await createSandboxPreviewGrant(params.env, "session", {
      expiresAt: Math.floor(Date.parse(consumed.session.expiresAt) / 1_000),
      jti: consumed.session.sessionJti,
      originId: consumed.session.originId,
      port: consumed.session.port,
      previewId: consumed.session.previewId,
      projectId: consumed.session.projectId,
      runId: claims.run_id,
      serviceName: consumed.session.serviceName,
      userId: consumed.session.userId,
    });

    sessionToken = sessionGrant.token;
  } else if (claims.jti !== authorised.session.sessionJti) {
    throw new AssistantError(
      "Sandbox preview access does not match this session",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return sandboxPreviewAuthorisationResponseSchema.parse({
    expiresAt: authorised.session.expiresAt,
    forwardToken: authorised.session.forwardToken,
    port: authorised.session.port,
    runId: claims.run_id,
    serviceName: authorised.session.serviceName,
    sessionToken,
  });
}
