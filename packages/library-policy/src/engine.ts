import type {
  AuthorizationCall,
  Context,
  Entities,
  EntityUid,
  Policy,
  PolicySet,
  Schema,
} from "@cedar-policy/cedar-wasm/nodejs";
import {
  isAuthorized,
  policySetTextToParts,
  policyToJson,
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

function entityKey(entity: EntityUid): string {
  return "__entity" in entity
    ? `${entity.__entity.type}::${entity.__entity.id}`
    : `${entity.type}::${entity.id}`;
}

function partitionPoliciesByAction(policies: PolicySet): (action: EntityUid) => PolicySet {
  const { staticPolicies } = policies;

  if (
    !staticPolicies ||
    typeof staticPolicies === "string" ||
    Array.isArray(staticPolicies) ||
    policies.templates ||
    policies.templateLinks
  ) {
    return () => policies;
  }

  const scoped = new Map<string, Record<string, Policy>>();
  const unscoped: Record<string, Policy> = {};

  for (const [id, policy] of Object.entries(staticPolicies)) {
    const parsed = policyToJson(policy);
    const constraint = parsed.type === "success" ? parsed.json.action : undefined;

    if (constraint?.op === "==" && "entity" in constraint) {
      const key = entityKey(constraint.entity);

      scoped.set(key, { ...scoped.get(key), [id]: policy });
    } else {
      unscoped[id] = policy;
    }
  }

  return (action) => ({
    staticPolicies: { ...unscoped, ...scoped.get(entityKey(action)) },
  });
}

export function createAuthorizer(
  bundle: PolicyBundle,
  { preparse = false }: { preparse?: boolean } = {},
) {
  const snapshot = structuredClone(bundle);

  validatePolicyBundle(snapshot);
  const cacheId = preparse ? `polychat-${++cachedBundleSequence}` : undefined;
  const policiesForAction = cacheId ? partitionPoliciesByAction(snapshot.policies) : undefined;
  const preparsedActions = new Set<string>();

  const requirePreparsed = (result: { type: string; errors?: { message: string }[] }) => {
    if (result.type === "failure") {
      throw new InvalidPolicyError((result.errors ?? []).map((error) => error.message));
    }
  };

  if (cacheId) {
    requirePreparsed(preparseSchema(cacheId, snapshot.schema));
  }

  const preparsedPolicySetId = (action: EntityUid): string | undefined => {
    if (!cacheId || !policiesForAction) {
      return undefined;
    }

    const id = `${cacheId}:${entityKey(action)}`;

    if (!preparsedActions.has(id)) {
      requirePreparsed(preparsePolicySet(id, policiesForAction(action)));
      preparsedActions.add(id);
    }

    return id;
  };

  return (request: PolicyRequest): PolicyDecision => {
    try {
      const call: AuthorizationCall = {
        ...request,
        entities: request.entities ?? [],
        schema: snapshot.schema,
        policies: snapshot.policies,
        validateRequest: true,
      };
      const policySetId = preparsedPolicySetId(request.action);
      const result =
        cacheId && policySetId
          ? statefulIsAuthorized({
              ...request,
              entities: call.entities,
              validateRequest: true,
              preparsedSchemaName: cacheId,
              preparsedPolicySetId: policySetId,
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
