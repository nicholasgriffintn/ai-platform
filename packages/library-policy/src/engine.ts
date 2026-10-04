import type {
  AuthorizationCall,
  Context,
  Entities,
  EntityUid,
  PolicySet,
  Schema,
} from "@cedar-policy/cedar-wasm/nodejs";
import {
  isAuthorized,
  policySetTextToParts,
  preparsePolicySet,
  preparseSchema,
  statefulIsAuthorized,
  validate,
} from "@ngriffin_uk/polychat-library-policy/runtime";

export type {
  Context as CedarContext,
  Entities as CedarEntities,
  EntityUid as CedarEntityUid,
  PolicySet as CedarPolicySet,
  Schema as CedarSchema,
};

export interface PolicyBundle {
  id: string;
  schema: Schema;
  policies: PolicySet;
}

export interface PolicyDecision {
  allowed: boolean;
  policyIds: readonly string[];
  errors: readonly string[];
}

export interface PolicyRequest {
  principal: EntityUid;
  action: EntityUid;
  resource: EntityUid;
  context: Context;
  entities?: Entities;
}

export class InvalidPolicyError extends Error {
  constructor(public readonly errors: readonly string[]) {
    super(`Invalid Cedar policy: ${errors.join("; ")}`);
    this.name = "InvalidPolicyError";
  }
}

export function namedPolicies(sources: Record<string, string>): PolicySet {
  const staticPolicies: Record<string, string> = {};

  for (const [id, source] of Object.entries(sources)) {
    const parsed = policySetTextToParts(source);

    if (parsed.type === "failure") {
      throw new InvalidPolicyError(parsed.errors.map((error) => error.message));
    }

    if (parsed.policy_templates.length > 0) {
      throw new InvalidPolicyError(["Linked templates must be supplied explicitly"]);
    }

    parsed.policies.forEach((policy, index) => {
      staticPolicies[`${id}:${index}`] = policy;
    });
  }

  return { staticPolicies };
}

export function validatePolicyBundle(bundle: PolicyBundle): void {
  const result = validate({ schema: bundle.schema, policies: bundle.policies });
  const errors =
    result.type === "failure"
      ? result.errors.map((error) => error.message)
      : result.validationErrors.map(({ error }) => error.message);

  if (errors.length > 0) {
    throw new InvalidPolicyError(errors);
  }
}

let cachedBundleSequence = 0;

export function createAuthorizer(
  bundle: PolicyBundle,
  { preparse = false }: { preparse?: boolean } = {},
) {
  const snapshot = structuredClone(bundle);

  validatePolicyBundle(snapshot);
  const cacheId = preparse ? `polychat-${++cachedBundleSequence}` : undefined;

  if (cacheId) {
    const results = [
      preparseSchema(cacheId, snapshot.schema),
      preparsePolicySet(cacheId, snapshot.policies),
    ];

    for (const result of results) {
      if (result.type === "failure") {
        throw new InvalidPolicyError(result.errors.map((error) => error.message));
      }
    }
  }

  return (request: PolicyRequest): PolicyDecision => {
    try {
      const call: AuthorizationCall = {
        ...request,
        entities: request.entities ?? [],
        schema: snapshot.schema,
        policies: snapshot.policies,
        validateRequest: true,
      };
      const result = cacheId
        ? statefulIsAuthorized({
            ...request,
            entities: call.entities,
            validateRequest: true,
            preparsedSchemaName: cacheId,
            preparsedPolicySetId: cacheId,
          })
        : isAuthorized(call);

      if (result.type === "failure") {
        return {
          allowed: false,
          policyIds: [],
          errors: result.errors.map((error) => error.message),
        };
      }

      const errors = result.response.diagnostics.errors.map(({ error }) => error.message);

      return {
        allowed: result.response.decision === "allow" && errors.length === 0,
        policyIds: result.response.diagnostics.reason,
        errors,
      };
    } catch {
      return { allowed: false, policyIds: [], errors: ["Cedar evaluation failed"] };
    }
  };
}
