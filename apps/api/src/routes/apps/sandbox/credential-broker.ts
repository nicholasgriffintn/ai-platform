import type { Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";
import {
  proxySandboxBranch,
  proxySandboxBranchDelivery,
  proxySandboxGitInfoRefs,
  proxySandboxGitOperation,
  proxySandboxPullRequestCreate,
  proxySandboxPullRequestList,
  proxySandboxRepository,
  sandboxBrokerBranchParamsSchema,
  sandboxBrokerDeliveryBodySchema,
  sandboxBrokerGitOperationParamsSchema,
  sandboxBrokerParamsSchema,
  sandboxBrokerPullRequestBodySchema,
  sandboxBrokerPullRequestQuerySchema,
} from "~/services/apps/sandbox/credential-broker";
import type { IEnv } from "~/types";

export function registerSandboxCredentialBrokerRoutes(app: Hono<{ Bindings: IEnv }>): void {
  addRoute(app, "get", "/apps/sandbox/credential-broker/:runId/git/info/refs", {
    tags: ["internal"],
    paramSchema: sandboxBrokerParamsSchema,
    handler: ({ raw, params, serviceContext }) =>
      proxySandboxGitInfoRefs({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
      }),
  });

  addRoute(app, "post", "/apps/sandbox/credential-broker/:runId/git/:operation", {
    tags: ["internal"],
    paramSchema: sandboxBrokerGitOperationParamsSchema,
    handler: ({ raw, params, serviceContext }) =>
      proxySandboxGitOperation({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
      }),
  });

  addRoute(app, "get", "/apps/sandbox/credential-broker/:runId/github/repository", {
    tags: ["internal"],
    paramSchema: sandboxBrokerParamsSchema,
    handler: ({ raw, params, serviceContext }) =>
      proxySandboxRepository({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
      }),
  });

  addRoute(app, "get", "/apps/sandbox/credential-broker/:runId/github/branches/:branch", {
    tags: ["internal"],
    paramSchema: sandboxBrokerBranchParamsSchema,
    handler: ({ raw, params, serviceContext }) =>
      proxySandboxBranch({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
      }),
  });

  addRoute(app, "post", "/apps/sandbox/credential-broker/:runId/github/deliveries", {
    tags: ["internal"],
    paramSchema: sandboxBrokerParamsSchema,
    bodySchema: sandboxBrokerDeliveryBodySchema,
    handler: ({ raw, params, body, serviceContext }) =>
      proxySandboxBranchDelivery({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
        body,
      }),
  });

  addRoute(app, "get", "/apps/sandbox/credential-broker/:runId/github/pulls", {
    tags: ["internal"],
    paramSchema: sandboxBrokerParamsSchema,
    querySchema: sandboxBrokerPullRequestQuerySchema,
    handler: ({ raw, params, query, serviceContext }) =>
      proxySandboxPullRequestList({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
        query,
      }),
  });

  addRoute(app, "post", "/apps/sandbox/credential-broker/:runId/github/pulls", {
    tags: ["internal"],
    paramSchema: sandboxBrokerParamsSchema,
    bodySchema: sandboxBrokerPullRequestBodySchema,
    handler: ({ raw, params, body, serviceContext }) =>
      proxySandboxPullRequestCreate({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
        body,
      }),
  });
}
