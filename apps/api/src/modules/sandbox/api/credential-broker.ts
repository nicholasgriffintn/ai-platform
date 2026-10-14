import { SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX } from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";

import { addRoute, INTERNAL_ROUTE_TAG } from "~/infrastructure/http/routeBuilder";
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
} from "~/modules/sandbox/application/credential-broker";
import type { IEnv } from "~/types";

export function registerSandboxCredentialBrokerRoutes(app: Hono<{ Bindings: IEnv }>): void {
  addRoute(app, "get", `${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/:runId/git/info/refs`, {
    tags: [INTERNAL_ROUTE_TAG],
    paramSchema: sandboxBrokerParamsSchema,
    handler: ({ raw, params, serviceContext }) =>
      proxySandboxGitInfoRefs({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
      }),
  });

  addRoute(app, "post", `${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/:runId/git/:operation`, {
    tags: [INTERNAL_ROUTE_TAG],
    paramSchema: sandboxBrokerGitOperationParamsSchema,
    handler: ({ raw, params, serviceContext }) =>
      proxySandboxGitOperation({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
      }),
  });

  addRoute(app, "get", `${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/:runId/github/repository`, {
    tags: [INTERNAL_ROUTE_TAG],
    paramSchema: sandboxBrokerParamsSchema,
    handler: ({ raw, params, serviceContext }) =>
      proxySandboxRepository({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
      }),
  });

  addRoute(app, "get", `${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/:runId/github/branches/:branch`, {
    tags: [INTERNAL_ROUTE_TAG],
    paramSchema: sandboxBrokerBranchParamsSchema,
    handler: ({ raw, params, serviceContext }) =>
      proxySandboxBranch({
        context: serviceContext,
        request: raw.req.raw,
        route: params,
      }),
  });

  addRoute(app, "post", `${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/:runId/github/deliveries`, {
    tags: [INTERNAL_ROUTE_TAG],
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

  addRoute(app, "get", `${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/:runId/github/pulls`, {
    tags: [INTERNAL_ROUTE_TAG],
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

  addRoute(app, "post", `${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/:runId/github/pulls`, {
    tags: [INTERNAL_ROUTE_TAG],
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
