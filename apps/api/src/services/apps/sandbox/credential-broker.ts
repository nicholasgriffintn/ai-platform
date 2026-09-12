import {
  SANDBOX_RUNS_CAPABILITY_ID,
  sandboxGitBranchNameSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { parseSandboxRunData } from "~/services/apps/sandbox/run-data";
import { AssistantError, ErrorType } from "~/utils/errors";
import { parseBearerToken } from "~/utils/http";
import { safeParseJson } from "~/utils/json";

import {
  type SandboxCredentialBrokerClaims,
  type SandboxCredentialBrokerOperation,
  verifySandboxCredentialBrokerGrant,
} from "./credential-broker-grants";
import { inspectGitReceivePackBody } from "./git-receive-pack";
import { resolveSandboxGitHubToken } from "./github-credentials";
import { getRunCoordinatorControl } from "./run-coordinator";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_GIT_BASE = "https://github.com";

export const sandboxBrokerParamsSchema = z.object({
  runId: z.string().trim().min(1),
});

export const sandboxBrokerGitOperationParamsSchema = sandboxBrokerParamsSchema.extend({
  operation: z.enum(["git-upload-pack", "git-receive-pack"]),
});

export const sandboxBrokerBranchParamsSchema = sandboxBrokerParamsSchema.extend({
  branch: sandboxGitBranchNameSchema,
});

export const sandboxBrokerPullRequestQuerySchema = z.object({
  base: sandboxGitBranchNameSchema,
  head: z.string().trim().min(1).max(300),
  per_page: z.coerce.number().int().min(1).max(10).default(1),
  state: z.literal("open").default("open"),
});

export const sandboxBrokerPullRequestBodySchema = z
  .object({
    base: sandboxGitBranchNameSchema,
    body: z.string().max(65_536),
    head: sandboxGitBranchNameSchema,
    title: z.string().trim().min(1).max(256),
  })
  .strict();

export const sandboxBrokerDeliveryBodySchema = z
  .object({
    head: sandboxGitBranchNameSchema,
    target: sandboxGitBranchNameSchema,
  })
  .strict();

type BrokerParams = z.infer<typeof sandboxBrokerParamsSchema>;
type GitOperationParams = z.infer<typeof sandboxBrokerGitOperationParamsSchema>;
type BranchParams = z.infer<typeof sandboxBrokerBranchParamsSchema>;
type PullRequestQuery = z.infer<typeof sandboxBrokerPullRequestQuerySchema>;
type PullRequestBody = z.infer<typeof sandboxBrokerPullRequestBodySchema>;
type DeliveryBody = z.infer<typeof sandboxBrokerDeliveryBodySchema>;

function requireGrant(request: Request): string {
  const grant = parseBearerToken(request.headers.get("Authorization") ?? undefined);

  if (!grant) {
    throw new AssistantError(
      "Sandbox credential broker grant is required",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  return grant;
}

function requireOperation(
  claims: SandboxCredentialBrokerClaims,
  operation: SandboxCredentialBrokerOperation,
): void {
  if (!claims.operations.includes(operation)) {
    throw new AssistantError(
      "Sandbox credential broker grant does not allow this operation",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }
}

async function authoriseBrokerRequest(params: {
  context: ServiceContext;
  request: Request;
  runId: string;
  operation: SandboxCredentialBrokerOperation;
}): Promise<{ claims: SandboxCredentialBrokerClaims; githubToken: string }> {
  const claims = await verifySandboxCredentialBrokerGrant({
    env: params.context.env,
    grant: requireGrant(params.request),
    runId: params.runId,
  });

  requireOperation(claims, params.operation);

  const record = await params.context.repositories.activities.getActivityByGroup(
    SANDBOX_RUNS_CAPABILITY_ID,
    params.runId,
  );
  const run = record ? parseSandboxRunData(safeParseJson(record.data)) : null;
  const control = await getRunCoordinatorControl(params.context.env, params.runId);

  if (
    !record ||
    !run ||
    control?.state !== "running" ||
    record.created_by_user_id !== Number(claims.sub) ||
    run.repo !== claims.repo ||
    run.installationId !== claims.installation_id ||
    run.status !== "running"
  ) {
    throw new AssistantError(
      "Sandbox credential broker grant is not active for this run",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return {
    claims,
    githubToken: await resolveSandboxGitHubToken({
      context: params.context,
      userId: Number(claims.sub),
      repo: claims.repo,
      installationId: claims.installation_id,
    }),
  };
}

function proxiedResponse(response: Response): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  const contentType = response.headers.get("Content-Type");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function gitAuthorizationHeader(githubToken: string): string {
  return `Basic ${btoa(`x-access-token:${githubToken}`)}`;
}

function gitProtocolHeader(request: Request): Record<string, string> {
  return request.headers.get("Git-Protocol") === "version=2" ? { "Git-Protocol": "version=2" } : {};
}

function githubApiRequest(params: {
  githubToken: string;
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
}): Promise<Response> {
  return fetch(`${GITHUB_API_BASE}${params.path}`, {
    method: params.method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${params.githubToken}`,
      ...(params.body ? { "Content-Type": "application/json" } : {}),
      "User-Agent": "Polychat-Sandbox-Broker",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });
}

export async function proxySandboxGitInfoRefs(params: {
  context: ServiceContext;
  request: Request;
  route: BrokerParams;
}): Promise<Response> {
  const service = new URL(params.request.url).searchParams.get("service");

  if (service !== "git-upload-pack" && service !== "git-receive-pack") {
    throw new AssistantError("Unsupported Git service", ErrorType.PARAMS_ERROR, 400);
  }

  const operation = service === "git-receive-pack" ? "repository_write" : "repository_read";
  const { claims, githubToken } = await authoriseBrokerRequest({
    context: params.context,
    request: params.request,
    runId: params.route.runId,
    operation,
  });
  const target = `${GITHUB_GIT_BASE}/${claims.repo}.git/info/refs?service=${service}`;
  const response = await fetch(target, {
    headers: {
      Accept: params.request.headers.get("Accept") ?? "*/*",
      Authorization: gitAuthorizationHeader(githubToken),
      ...gitProtocolHeader(params.request),
      "User-Agent": "Polychat-Sandbox-Broker",
    },
  });

  return proxiedResponse(response);
}

export async function proxySandboxGitOperation(params: {
  context: ServiceContext;
  request: Request;
  route: GitOperationParams;
}): Promise<Response> {
  const requiredOperation =
    params.route.operation === "git-receive-pack" ? "repository_write" : "repository_read";
  const expectedContentType = `application/x-${params.route.operation}-request`;
  const contentType = params.request.headers.get("Content-Type")?.split(";", 1)[0];

  if (contentType !== expectedContentType) {
    throw new AssistantError("Invalid Git request content type", ErrorType.PARAMS_ERROR, 400);
  }

  const { claims, githubToken } = await authoriseBrokerRequest({
    context: params.context,
    request: params.request,
    runId: params.route.runId,
    operation: requiredOperation,
  });
  let body = params.request.body;

  if (params.route.operation === "git-receive-pack") {
    const inspected = await inspectGitReceivePackBody(body);

    if (
      inspected.refs.length === 0 ||
      inspected.refs.some((ref) => !claims.write_refs.includes(ref))
    ) {
      await inspected.body.cancel();
      throw new AssistantError(
        "Sandbox credential broker grant does not allow this Git ref",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    body = inspected.body;
  }

  const response = await fetch(`${GITHUB_GIT_BASE}/${claims.repo}.git/${params.route.operation}`, {
    method: "POST",
    headers: {
      Accept: params.request.headers.get("Accept") ?? "*/*",
      Authorization: gitAuthorizationHeader(githubToken),
      "Content-Type": expectedContentType,
      ...gitProtocolHeader(params.request),
      "User-Agent": "Polychat-Sandbox-Broker",
    },
    body,
  });

  return proxiedResponse(response);
}

async function proxyGitHubApi(params: {
  context: ServiceContext;
  request: Request;
  runId: string;
  operation: SandboxCredentialBrokerOperation;
  path: (repo: string) => string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  validateClaims?: (claims: SandboxCredentialBrokerClaims) => void;
}): Promise<Response> {
  const { claims, githubToken } = await authoriseBrokerRequest({
    context: params.context,
    request: params.request,
    runId: params.runId,
    operation: params.operation,
  });

  params.validateClaims?.(claims);

  const response = await githubApiRequest({
    githubToken,
    path: params.path(claims.repo),
    method: params.method,
    body: params.body,
  });

  return proxiedResponse(response);
}

export async function proxySandboxBranchDelivery(params: {
  context: ServiceContext;
  request: Request;
  route: BrokerParams;
  body: DeliveryBody;
}): Promise<Response> {
  const { claims, githubToken } = await authoriseBrokerRequest({
    context: params.context,
    request: params.request,
    runId: params.route.runId,
    operation: "repository_write",
  });
  const headRef = `refs/heads/${params.body.head}`;
  const targetRef = `refs/heads/${params.body.target}`;

  if (!claims.write_refs.includes(headRef) || claims.delivery_target_ref !== targetRef) {
    throw new AssistantError(
      "Sandbox credential broker grant does not allow this branch delivery",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const headResponse = await githubApiRequest({
    githubToken,
    path: `${repositoryApiPath(claims.repo)}/git/ref/heads/${encodeURIComponent(params.body.head)}`,
    method: "GET",
  });

  if (!headResponse.ok) {
    return proxiedResponse(headResponse);
  }

  const head = (await headResponse.json()) as { object?: { sha?: unknown } };

  if (typeof head.object?.sha !== "string" || !head.object.sha.trim()) {
    throw new AssistantError(
      "GitHub returned invalid staged delivery evidence",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const deliveryResponse = await githubApiRequest({
    githubToken,
    path: `${repositoryApiPath(claims.repo)}/git/refs/heads/${encodeURIComponent(
      params.body.target,
    )}`,
    method: "PATCH",
    body: { sha: head.object.sha, force: false },
  });

  if (deliveryResponse.ok) {
    await githubApiRequest({
      githubToken,
      path: `${repositoryApiPath(claims.repo)}/git/refs/heads/${encodeURIComponent(
        params.body.head,
      )}`,
      method: "DELETE",
    }).catch(() => undefined);
  }

  return proxiedResponse(deliveryResponse);
}

function repositoryApiPath(repo: string): string {
  const [owner, name] = repo.split("/");

  return `/repos/${encodeURIComponent(owner ?? "")}/${encodeURIComponent(name ?? "")}`;
}

export function proxySandboxRepository(params: {
  context: ServiceContext;
  request: Request;
  route: BrokerParams;
}): Promise<Response> {
  return proxyGitHubApi({
    ...params,
    runId: params.route.runId,
    operation: "repository_read",
    path: repositoryApiPath,
    method: "GET",
  });
}

export function proxySandboxBranch(params: {
  context: ServiceContext;
  request: Request;
  route: BranchParams;
}): Promise<Response> {
  return proxyGitHubApi({
    ...params,
    runId: params.route.runId,
    operation: "repository_read",
    path: (repo) =>
      `${repositoryApiPath(repo)}/branches/${encodeURIComponent(params.route.branch)}`,
    method: "GET",
  });
}

export function proxySandboxPullRequestList(params: {
  context: ServiceContext;
  request: Request;
  route: BrokerParams;
  query: PullRequestQuery;
}): Promise<Response> {
  const query = new URLSearchParams({
    base: params.query.base,
    head: params.query.head,
    per_page: String(params.query.per_page),
    state: params.query.state,
  });

  return proxyGitHubApi({
    ...params,
    runId: params.route.runId,
    operation: "repository_read",
    path: (repo) => `${repositoryApiPath(repo)}/pulls?${query.toString()}`,
    method: "GET",
  });
}

export function proxySandboxPullRequestCreate(params: {
  context: ServiceContext;
  request: Request;
  route: BrokerParams;
  body: PullRequestBody;
}): Promise<Response> {
  return proxyGitHubApi({
    ...params,
    runId: params.route.runId,
    operation: "pull_request_write",
    path: (repo) => `${repositoryApiPath(repo)}/pulls`,
    method: "POST",
    body: params.body,
    validateClaims: (claims) => {
      if (!claims.write_refs.includes(`refs/heads/${params.body.head}`)) {
        throw new AssistantError(
          "Sandbox credential broker grant does not allow this pull request head",
          ErrorType.AUTHORISATION_ERROR,
          403,
        );
      }
    },
  });
}
