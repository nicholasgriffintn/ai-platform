import type { ModelVersionAttributes, PolicyRule } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSPACE_POLICY_RULES,
  evaluatePolicies,
  isVerdictCovered,
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
  it("allows a clean, permissive, inspected model under the defaults", () => {
    const verdict = evaluatePolicies(
      { kind: "model", source: "huggingface", attributes, evidence: inspected },
      [workspace()],
    );

    expect(verdict).toEqual({ effect: "allow", matches: [], policyHashes: ["ws-hash"] });
  });

  it("holds uninspected versions for review and blocks a dangerous pickle over everything else", () => {
    const uninspected = evaluatePolicies(
      { kind: "model", source: "huggingface", attributes, evidence: [] },
      [workspace()],
    );

    expect(uninspected.effect).toBe("review");
    expect(uninspected.matches.map((match) => match.ruleId)).toEqual(["inspection-complete"]);

    const dangerous = evaluatePolicies(
      {
        kind: "model",
        source: "huggingface",
        attributes: { ...attributes, formats: ["pickle"], remoteCode: true, licence: "other-x" },
        evidence: [
          ...inspected,
          { kind: "pickle_imports", status: "fail", summary: "posix.system" },
        ],
      },
      [workspace()],
    );

    expect(dangerous.effect).toBe("block");
    expect(dangerous.matches.map((match) => match.ruleId).sort()).toEqual([
      "known-licence",
      "no-remote-code",
      "pickle-imports-clean",
      "prefer-safetensors",
    ]);
  });

  it("lets a project policy narrow but never loosen the workspace verdict", () => {
    const subject: PolicySubject = {
      kind: "model",
      source: "huggingface",
      attributes: { ...attributes, gated: true },
      evidence: inspected,
      route: { region: "us", weightsVerified: true },
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

  it("ignores route conditions when evaluating a version without a route", () => {
    const verdict = evaluatePolicies(
      { kind: "model", source: "huggingface", attributes, evidence: inspected },
      [
        workspace([
          {
            id: "uk-only",
            effect: "block",
            when: { type: "route_region", op: "in", values: ["us"] },
          },
        ]),
      ],
    );

    expect(verdict.effect).toBe("allow");
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

  it("needs no approval when nothing reaches review", () => {
    expect(isVerdictCovered(verdict(match("prefer-safetensors", "warn")), [], now)).toBe(true);
  });

  it("covers the issues an approver saw and reopens when a new one appears", () => {
    const approved = {
      verdict: verdict(match("gated-terms", "review")),
      isException: false,
      expiresAt: null,
    };

    expect(isVerdictCovered(verdict(match("gated-terms", "review")), [approved], now)).toBe(true);
    expect(
      isVerdictCovered(
        verdict(match("gated-terms", "review"), match("no-drift", "review")),
        [approved],
        now,
      ),
    ).toBe(false);
  });

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
