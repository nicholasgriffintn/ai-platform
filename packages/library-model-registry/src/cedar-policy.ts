import {
  actionSchema,
  booleanAttribute,
  cedarLong,
  cedarString,
  cedarStringSet,
  cedarStringInSet,
  createAuthorizer,
  longAttribute,
  stringAttribute,
  stringSetAttribute,
  type CedarContext,
  type PolicyBundle,
} from "@ngriffin_uk/polychat-library-policy";
import type { PolicyCondition, PolicyRule } from "@ngriffin_uk/polychat-schemas";
import { assertUnreachable, canonicalJson } from "@ngriffin_uk/polychat-utility-core";

import type { PolicySubject } from "./policy.js";

export const GOVERNANCE_SCHEMA = actionSchema({
  "governance.match": {
    kind: stringAttribute,
    source: stringAttribute,
    licence: stringAttribute,
    formats: stringSetAttribute,
    remoteCode: booleanAttribute,
    gated: booleanAttribute,
    parameterCount: longAttribute,
    hasParameterCount: booleanAttribute,
    evidenceKinds: stringSetAttribute,
    evidenceStatuses: stringSetAttribute,
    routePresent: booleanAttribute,
    region: stringAttribute,
    jurisdiction: stringAttribute,
    retention: stringAttribute,
    weightsVerified: booleanAttribute,
    datasetPresent: booleanAttribute,
    lawfulBasis: stringAttribute,
    containsCustomerData: booleanAttribute,
  },
});

const METADATA_CONDITIONS = new Set<PolicyCondition["type"]>([
  "always",
  "asset_kind",
  "licence",
  "source",
  "remote_code",
  "gated",
  "parameters_above",
  "lawful_basis",
  "customer_data",
]);

export function isMetadataPolicy(rule: PolicyRule): boolean {
  return rule.when.type === "cedar"
    ? rule.when.metadataOnly
    : METADATA_CONDITIONS.has(rule.when.type);
}

export function conditionToCedar(condition: Exclude<PolicyCondition, { type: "cedar" }>): string {
  switch (condition.type) {
    case "always":
      return "true";
    case "asset_kind":
      return cedarStringInSet(condition.values, "context.kind");
    case "licence":
      return cedarStringInSet(condition.values, "context.licence", condition.op === "not_in");
    case "source":
      return cedarStringInSet(condition.values, "context.source", condition.op === "not_in");
    case "format":
      return condition.op === "includes"
        ? `context.formats.containsAny(${cedarStringSet(condition.values)})`
        : `!context.formats.isEmpty() && ${cedarStringSet(condition.values)}.containsAll(context.formats)`;
    case "remote_code":
      return "context.remoteCode";
    case "gated":
      return "context.gated";
    case "parameters_above":
      return `context.hasParameterCount && context.parameterCount > ${cedarLong(Math.floor(condition.value))}`;
    case "evidence":
      return `context.evidenceStatuses.containsAny(${cedarStringSet(condition.statuses.map((status) => `${condition.kind}/${status}`))})`;
    case "evidence_missing":
      return `!context.evidenceKinds.contains(${cedarString(condition.kind)})`;
    case "route_region":
      return `context.routePresent && ${cedarStringInSet(condition.values, "context.region", condition.op === "not_in")}`;
    case "route_weights_unverified":
      return "context.routePresent && !context.weightsVerified";
    case "route_jurisdiction":
      return `context.routePresent && ${cedarStringInSet(condition.values, "context.jurisdiction", condition.op === "not_in")}`;
    case "route_retention":
      return `context.routePresent && ${cedarStringInSet(condition.values, "context.retention")}`;
    case "lawful_basis":
      return `context.datasetPresent && ${cedarStringInSet(condition.values, "context.lawfulBasis", condition.op === "not_in")}`;
    case "customer_data":
      return "context.datasetPresent && context.containsCustomerData";
    default:
      return assertUnreachable(condition);
  }
}

export function toCedarPolicyRule(rule: PolicyRule): PolicyRule {
  if (rule.when.type === "cedar") {
    return rule;
  }

  return {
    ...rule,
    when: {
      type: "cedar",
      source: `permit(principal, action == Polychat::Action::"governance.match", resource)\nwhen { ${conditionToCedar(rule.when)} };`,
      metadataOnly: isMetadataPolicy(rule),
    },
  };
}

export function governanceContext(subject: PolicySubject): CedarContext {
  return {
    kind: subject.kind,
    source: subject.source,
    licence: subject.attributes.licence ?? "unknown",
    formats: subject.attributes.formats,
    remoteCode: subject.attributes.remoteCode,
    gated: subject.attributes.gated,
    parameterCount: subject.attributes.parameterCount ?? 0,
    hasParameterCount: subject.attributes.parameterCount !== null,
    evidenceKinds: subject.evidence.map((item) => item.kind),
    evidenceStatuses: subject.evidence.map((item) => `${item.kind}/${item.status}`),
    routePresent: Boolean(subject.route),
    region: subject.route?.region ?? "",
    jurisdiction: subject.route?.jurisdiction ?? "unknown",
    retention: subject.route?.retention ?? "",
    weightsVerified: subject.route?.weightsVerified ?? false,
    datasetPresent: Boolean(subject.dataset),
    lawfulBasis: subject.dataset?.lawfulBasis ?? "",
    containsCustomerData: subject.dataset?.containsCustomerData ?? false,
  };
}

const authorizers = new Map<string, ReturnType<typeof createAuthorizer>>();
const CACHE_LIMIT = 100;

export function governanceRuleAuthorizer(rule: PolicyRule) {
  const cedar = toCedarPolicyRule(rule);

  if (cedar.when.type !== "cedar") {
    throw new Error("Cedar conversion failed");
  }

  const key = canonicalJson({ id: cedar.id, source: cedar.when.source });
  const existing = authorizers.get(key);

  if (existing) {
    return existing;
  }

  const bundle: PolicyBundle = {
    id: rule.id,
    schema: GOVERNANCE_SCHEMA,
    policies: { staticPolicies: { [rule.id]: cedar.when.source } },
  };
  const authorizer = createAuthorizer(bundle);

  if (authorizers.size >= CACHE_LIMIT) {
    authorizers.clear();
  }

  authorizers.set(key, authorizer);

  return authorizer;
}

export function validateGovernanceRules(rules: readonly PolicyRule[]): PolicyRule[] {
  return rules.map((rule) => {
    governanceRuleAuthorizer(rule);

    return toCedarPolicyRule(rule);
  });
}
