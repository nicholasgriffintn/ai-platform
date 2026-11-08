import type { ModelVersionAttributes, PolicyRule } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSPACE_POLICY_RULES,
  evaluatePolicies,
  isVerdictCovered,
  validateGovernanceRules,
  type PolicySubject,
} from "../index.js";

const attributes: ModelVersionAttributes = {
  licence: "apache-2.0",
  formats: ["safetensors"],
  parameterCount: 7_600_000_000,
  gated: false,
  remoteCode: false,
  pipelineTag: "text-generation",
  libraryName: "transformers",
  tags: [],
  baseModels: [],
  totalBytes: 15_000_000_000,
  trainingComputeFlops: null,
  architecture: null,
  location: null,
};

const inspected: PolicySubject["evidence"] = [
  { kind: "format", status: "pass", summary: "safetensors" },
  { kind: "hub_scan", status: "pass", summary: "clean" },
];

const workspace = (rules: PolicyRule[] = DEFAULT_WORKSPACE_POLICY_RULES) => ({
  id: "ws-policy",
  hash: "ws-hash",
  scope: "workspace" as const,
  rules,
});

describe("evaluatePolicies", () => {
  it("validates native Cedar before accepting policies and blocks malformed subject facts", () => {
    const rules: PolicyRule[] = [
      {
        id: "remote",
        effect: "review",
        when: {
          type: "cedar",
          metadataOnly: true,
          source:
            'permit(principal, action == Polychat::Action::"governance.match", resource) when { context.remoteCode };',
        },
      },
    ];

    expect(validateGovernanceRules(rules)).toEqual(rules);
    expect(() =>
      validateGovernanceRules([
        {
          ...rules[0],
          when: {
            type: "cedar",
            metadataOnly: false,
            source: "permit(principal, action, resource) when { context.missing };",
          },
        },
      ]),
    ).toThrow("Invalid Cedar policy");
    const clean = {
      kind: "model" as const,
      source: "huggingface" as const,
      attributes,
      evidence: inspected,
    };

    expect(evaluatePolicies(clean, [workspace(rules)]).effect).toBe("allow");
    expect(
      evaluatePolicies({ ...clean, attributes: { ...attributes, remoteCode: true } }, [
        workspace(rules),
      ]).effect,
    ).toBe("review");
    const invalid = evaluatePolicies(
      { ...clean, attributes: { ...attributes, parameterCount: Number.NaN } },
      [workspace(rules)],
    );

    expect(invalid.effect).toBe("block");
    expect(invalid.matches[0].evaluationFailed).toBe(true);
    expect(
      isVerdictCovered(
        invalid,
        [{ verdict: invalid, isException: true, expiresAt: null }],
        new Date(),
      ),
    ).toBe(false);
  });
  it("lets a project policy narrow but never loosen the workspace verdict", () => {
    const subject: PolicySubject = {
      kind: "model",
      source: "huggingface",
      attributes: { ...attributes, gated: true },
      evidence: inspected,
      route: { region: "us", weightsVerified: true, jurisdiction: "us", retention: "provider" },
    };
    const project = {
      id: "project-policy",
      hash: "project-hash",
      scope: "project" as const,
      rules: [
        {
          id: "uk-eu-only",
          effect: "block" as const,
          when: { type: "route_region" as const, op: "not_in" as const, values: ["uk", "eu"] },
        },
        { id: "relax", effect: "allow" as const, when: { type: "always" as const } },
      ],
    };

    const verdict = evaluatePolicies(subject, [workspace(), project]);

    expect(verdict.effect).toBe("block");
    expect(verdict.policyHashes).toEqual(["ws-hash", "project-hash"]);
    expect(verdict.matches.find((match) => match.ruleId === "gated-terms")?.scope).toBe(
      "workspace",
    );
  });
});

describe("isVerdictCovered", () => {
  const match = (
    ruleId: string,
    effect: "review" | "block" | "warn",
    scope: "workspace" | "project" = "workspace",
  ) => ({
    policyId: "p",
    policyHash: "h",
    scope,
    ruleId,
    effect,
    reason: ruleId,
  });
  const verdict = (...matches: ReturnType<typeof match>[]) => ({
    effect: matches.some((item) => item.effect === "block")
      ? ("block" as const)
      : matches.some((item) => item.effect === "review")
        ? ("review" as const)
        : ("allow" as const),
    matches,
    policyHashes: ["h"],
  });
  const now = new Date("2026-09-24T12:00:00Z");

  it("only lets unexpired exceptions cover a block", () => {
    const blocked = verdict(match("pickle-imports-clean", "block"));
    const approval = { verdict: blocked, isException: false, expiresAt: null };

    expect(isVerdictCovered(blocked, [approval], now)).toBe(false);
    expect(
      isVerdictCovered(
        blocked,
        [{ ...approval, isException: true, expiresAt: "2026-12-01T00:00:00Z" }],
        now,
      ),
    ).toBe(true);
    expect(
      isVerdictCovered(
        blocked,
        [{ ...approval, isException: true, expiresAt: "2026-09-01T00:00:00Z" }],
        now,
      ),
    ).toBe(false);
  });
});
