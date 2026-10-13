import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type {
  EvidenceKind,
  EvidenceStatus,
  ModelAssetKind,
  ModelAssetSource,
  ModelVersionAttributes,
  PolicyEffect,
  PolicyMatch,
  PolicyRule,
  PolicyVerdict,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, sha256Hex } from "@ngriffin_uk/polychat-utility-core";

import {
  governanceContext,
  governanceRuleAuthorizer,
  isMetadataPolicy,
  toCedarPolicyRule,
} from "./cedar-policy.js";
import { DEFAULT_ALLOWED_LICENCES } from "./licence.js";
import { policyMatchReason } from "./policy-reason.js";

export interface PolicySubjectEvidence {
  kind: EvidenceKind;
  status: EvidenceStatus;
  summary: string;
}

export interface PolicySubjectRoute {
  region: string;
  weightsVerified: boolean;
  jurisdiction: string | null;
  retention: "zero" | "provider" | "self" | null;
}

export interface PolicySubjectDataset {
  lawfulBasis: string;
  containsCustomerData: boolean;
}

export interface PolicySubject {
  kind: ModelAssetKind;
  source: ModelAssetSource;
  attributes: ModelVersionAttributes;
  evidence: readonly PolicySubjectEvidence[];
  dataset?: PolicySubjectDataset | null;
  route?: PolicySubjectRoute;
}

export interface ScopedPolicy {
  id: string;
  hash: string;
  scope: "workspace" | "project";
  rules: readonly PolicyRule[];
}

const EFFECT_SEVERITY: Record<PolicyEffect, number> = { allow: 0, warn: 1, review: 2, block: 3 };

const defaultWorkspaceRules: PolicyRule[] = [
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
  {
    id: "uploaded-provenance",
    description: "Uploaded or bucket weights need a person to confirm where they came from",
    effect: "review",
    when: { type: "source", op: "in", values: ["upload", "bucket"] },
  },
  {
    id: "upload-integrity",
    description: "Uploaded files must hash to what the uploader declared",
    effect: "block",
    when: { type: "evidence", kind: "upload_integrity", statuses: ["fail"] },
  },
  {
    id: "dataset-lawful-basis",
    description: "Datasets without a stated lawful basis for personal data need review",
    effect: "review",
    when: { type: "lawful_basis", op: "in", values: ["unknown"] },
  },
  {
    id: "customer-data",
    description: "Customer data needs a person to confirm contracts allow training on it",
    effect: "review",
    when: { type: "customer_data" },
  },
  {
    id: "teacher-terms",
    description:
      "Outputs of models whose terms forbid training competitors cannot train new models",
    effect: "block",
    when: { type: "evidence", kind: "teacher_terms", statuses: ["fail"] },
  },
  {
    id: "erasure-withdrawn",
    description: "A withdrawal erasure request stops every version trained on the erased rows",
    effect: "block",
    when: { type: "evidence", kind: "erasure", statuses: ["fail"] },
  },
  {
    id: "erasure-retrain",
    description: "A retrain-by erasure request flags versions until a clean retrain replaces them",
    effect: "warn",
    when: { type: "evidence", kind: "erasure", statuses: ["warn"] },
  },
];

export const DEFAULT_WORKSPACE_POLICY_RULES = defaultWorkspaceRules.map(toCedarPolicyRule);

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

export function evaluatePolicies(
  subject: PolicySubject,
  policies: readonly ScopedPolicy[],
  { metadataOnly = false }: { metadataOnly?: boolean } = {},
): PolicyVerdict {
  const matches: PolicyMatch[] = [];
  const context = governanceContext(subject);

  for (const policy of policies) {
    for (const rule of policy.rules) {
      if (metadataOnly && !isMetadataPolicy(rule)) {
        continue;
      }

      const decision = governanceRuleAuthorizer(rule)({
        principal: { type: "Polychat::Actor", id: "governance" },
        action: { type: "Polychat::Action", id: "governance.match" },
        resource: { type: "Polychat::Resource", id: "version" },
        context,
      });
      const failed = decision.errors.length > 0;
      const reason = failed
        ? "Cedar evaluation failed; review the policy and version facts"
        : policyMatchReason(rule.when, subject);

      if (failed || decision.policyIds.includes(rule.id)) {
        matches.push({
          policyId: policy.id,
          policyHash: policy.hash,
          scope: policy.scope,
          ruleId: rule.id,
          effect: failed ? "block" : rule.effect,
          ...(failed ? { evaluationFailed: true } : {}),
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
  return current.matches.filter((match) => {
    if (!isEffectAtLeast(match.effect, "review")) {
      return false;
    }

    return !approvals.some(
      (approval) =>
        authorise("governance.cover", {
          evaluationFailed: match.evaluationFailed === true,
          expiresAt: approval.expiresAt === null ? 0 : new Date(approval.expiresAt).getTime(),
          now: now.getTime(),
          effect: match.effect,
          exception: approval.isException,
          seen: approval.verdict.matches.map(
            (seen) => `${seen.scope}:${seen.policyHash}:${seen.ruleId}`,
          ),
          matchKey: `${match.scope}:${match.policyHash}:${match.ruleId}`,
        }).allowed,
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
