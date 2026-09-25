import type {
  EvidenceKind,
  EvidenceStatus,
  ModelAssetKind,
  ModelAssetSource,
  ModelVersionAttributes,
  PolicyCondition,
  PolicyEffect,
  PolicyMatch,
  PolicyRule,
  PolicyVerdict,
} from "@ngriffin_uk/polychat-schemas";
import {
  assertUnreachable,
  canonicalJson,
  formatParameterCount,
  sha256Hex,
} from "@ngriffin_uk/polychat-utility-core";

import { DEFAULT_ALLOWED_LICENCES } from "./licence.js";

export interface PolicySubjectEvidence {
  kind: EvidenceKind;
  status: EvidenceStatus;
  summary: string;
}

export interface PolicySubjectRoute {
  region: string;
  weightsVerified: boolean;
}

export interface PolicySubject {
  kind: ModelAssetKind;
  source: ModelAssetSource;
  attributes: ModelVersionAttributes;
  evidence: readonly PolicySubjectEvidence[];
  route?: PolicySubjectRoute;
}

export interface ScopedPolicy {
  id: string;
  hash: string;
  scope: "workspace" | "project";
  rules: readonly PolicyRule[];
}

const EFFECT_SEVERITY: Record<PolicyEffect, number> = { allow: 0, warn: 1, review: 2, block: 3 };

export const DEFAULT_WORKSPACE_POLICY_RULES: PolicyRule[] = [
  {
    id: "inspection-complete",
    description: "Static inspection must finish before a version can be used",
    effect: "review",
    when: { type: "evidence_missing", kind: "format" },
  },
  {
    id: "hub-scan-clean",
    description: "Hugging Face malware and pickle scans must not report unsafe files",
    effect: "block",
    when: { type: "evidence", kind: "hub_scan", statuses: ["fail"] },
  },
  {
    id: "pickle-imports-clean",
    description: "Pickled weights must not import code outside the known-safe set",
    effect: "block",
    when: { type: "evidence", kind: "pickle_imports", statuses: ["fail"] },
  },
  {
    id: "chat-template-safe",
    description: "Chat templates run inside the serving stack and must not reach Python internals",
    effect: "block",
    when: { type: "evidence", kind: "chat_template", statuses: ["fail"] },
  },
  {
    id: "no-remote-code",
    description: "Models that need trust_remote_code run repository code at load time",
    effect: "review",
    when: { type: "remote_code" },
  },
  {
    id: "known-licence",
    description: "Licences outside the allowed set need a person to read them",
    effect: "review",
    when: { type: "licence", op: "not_in", values: [...DEFAULT_ALLOWED_LICENCES] },
  },
  {
    id: "gated-terms",
    description: "Accepting gated model terms is a legal act for the workspace",
    effect: "review",
    when: { type: "gated" },
  },
  {
    id: "prefer-safetensors",
    description: "Pickle-only weights are riskier to load than safetensors",
    effect: "warn",
    when: { type: "format", op: "only", values: ["pickle"] },
  },
  {
    id: "dataset-pii",
    description: "Datasets with personal data in the sampled rows need review",
    effect: "review",
    when: { type: "evidence", kind: "pii", statuses: ["fail"] },
  },
  {
    id: "no-drift",
    description: "A replay score well below the approval baseline reopens review",
    effect: "review",
    when: { type: "evidence", kind: "drift", statuses: ["fail"] },
  },
  {
    id: "route-weights-unverified",
    description: "Serverless providers do not prove which weights they serve",
    effect: "warn",
    when: { type: "route_weights_unverified" },
  },
];

export async function hashPolicyRules(rules: readonly PolicyRule[]): Promise<string> {
  return sha256Hex(canonicalJson(rules));
}

export function maxEffect(effects: readonly PolicyEffect[]): PolicyEffect {
  return effects.reduce<PolicyEffect>(
    (highest, effect) => (EFFECT_SEVERITY[effect] > EFFECT_SEVERITY[highest] ? effect : highest),
    "allow",
  );
}

export function isEffectAtLeast(effect: PolicyEffect, threshold: PolicyEffect): boolean {
  return EFFECT_SEVERITY[effect] >= EFFECT_SEVERITY[threshold];
}

const METADATA_ONLY_CONDITIONS = new Set<PolicyCondition["type"]>([
  "always",
  "asset_kind",
  "licence",
  "source",
  "remote_code",
  "gated",
  "parameters_above",
]);

export function evaluatePolicies(
  subject: PolicySubject,
  policies: readonly ScopedPolicy[],
  { metadataOnly = false }: { metadataOnly?: boolean } = {},
): PolicyVerdict {
  const matches: PolicyMatch[] = [];

  for (const policy of policies) {
    for (const rule of policy.rules) {
      if (metadataOnly && !METADATA_ONLY_CONDITIONS.has(rule.when.type)) {
        continue;
      }

      const reason = matchCondition(rule.when, subject);

      if (reason !== null) {
        matches.push({
          policyId: policy.id,
          policyHash: policy.hash,
          scope: policy.scope,
          ruleId: rule.id,
          effect: rule.effect,
          reason: rule.description ? `${reason}. ${rule.description}` : reason,
        });
      }
    }
  }

  return {
    effect: maxEffect(matches.map((match) => match.effect)),
    matches,
    policyHashes: policies.map((policy) => policy.hash),
  };
}

function matchCondition(condition: PolicyCondition, subject: PolicySubject): string | null {
  const { attributes } = subject;

  switch (condition.type) {
    case "always":
      return "Applies to every version in scope";
    case "asset_kind":
      return condition.values.includes(subject.kind) ? `Asset is a ${subject.kind}` : null;
    case "licence": {
      const licence = attributes.licence ?? "unknown";
      const listed = condition.values.includes(licence);

      if (condition.op === "in" ? listed : !listed) {
        return `Licence is ${licence}`;
      }

      return null;
    }

    case "source": {
      const listed = condition.values.includes(subject.source);

      return (condition.op === "in" ? listed : !listed) ? `Source is ${subject.source}` : null;
    }

    case "format": {
      const formats = attributes.formats;

      if (formats.length === 0) {
        return null;
      }

      if (condition.op === "includes") {
        const found = formats.filter((format) => condition.values.includes(format));

        return found.length > 0 ? `Weights include ${found.join(", ")}` : null;
      }

      return formats.every((format) => condition.values.includes(format))
        ? `Weights are only ${formats.join(", ")}`
        : null;
    }

    case "remote_code":
      return attributes.remoteCode ? "Loading requires trust_remote_code" : null;
    case "gated":
      return attributes.gated ? "Repository is gated behind accepted terms" : null;
    case "parameters_above":
      return attributes.parameterCount !== null && attributes.parameterCount > condition.value
        ? `${formatParameterCount(attributes.parameterCount)} parameters exceeds ${formatParameterCount(condition.value)}`
        : null;
    case "evidence": {
      const found = subject.evidence.find(
        (item) => item.kind === condition.kind && condition.statuses.includes(item.status),
      );

      return found ? `${condition.kind} evidence is ${found.status}: ${found.summary}` : null;
    }

    case "evidence_missing":
      return subject.evidence.some((item) => item.kind === condition.kind)
        ? null
        : `No ${condition.kind} evidence recorded yet`;
    case "route_region": {
      if (!subject.route) {
        return null;
      }

      const listed = condition.values.includes(subject.route.region);

      return (condition.op === "in" ? listed : !listed)
        ? `Route serves from ${subject.route.region}`
        : null;
    }

    case "route_weights_unverified":
      return subject.route && !subject.route.weightsVerified
        ? "Provider does not prove which weights it serves"
        : null;

    default:
      return assertUnreachable(condition);
  }
}

export interface ApprovalCoverage {
  verdict: PolicyVerdict;
  isException: boolean;
  expiresAt: string | null;
}

export function needsHumanDecision(verdict: PolicyVerdict): boolean {
  return isEffectAtLeast(verdict.effect, "review");
}

export function uncoveredMatches(
  current: PolicyVerdict,
  approvals: readonly ApprovalCoverage[],
  now: Date,
): PolicyMatch[] {
  const live = approvals.filter(
    (approval) => approval.expiresAt === null || new Date(approval.expiresAt) > now,
  );

  return current.matches.filter((match) => {
    if (!isEffectAtLeast(match.effect, "review")) {
      return false;
    }

    return !live.some(
      (approval) =>
        (match.effect !== "block" || approval.isException) &&
        approval.verdict.matches.some(
          (seen) => seen.ruleId === match.ruleId && seen.scope === match.scope,
        ),
    );
  });
}

export function isVerdictCovered(
  current: PolicyVerdict,
  approvals: readonly ApprovalCoverage[],
  now: Date,
): boolean {
  return uncoveredMatches(current, approvals, now).length === 0;
}
