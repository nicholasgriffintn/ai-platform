import {
  buildSkillDocument,
  parseSkillDocument,
  SkillCatalog,
  toSkillDefinition,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listPerMessageSkillCandidates, selectPerMessageSkills } from "../per-message";

const evaluateDecisionPolicy = vi.hoisted(() => vi.fn());

vi.mock("~/infrastructure/ai", () => ({ ai: { evaluateDecisionPolicy } }));

function availability(id: string, activation?: "per-message"): SkillAvailability {
  return {
    id,
    name: id,
    description: `Use ${id}`,
    category: "Other",
    tags: [],
    alwaysOn: false,
    ...(activation ? { activation } : {}),
    requirement: { modelCapabilities: [], tools: [], suggestedTools: [] },
    state: "ready",
    reason: "Enabled for this conversation.",
  };
}

function catalog(documents: Record<string, string>) {
  return new SkillCatalog(
    Object.entries(documents).map(([directory, rawContent]) => ({
      directory,
      rawContent,
      resources: [],
    })),
  );
}

describe("per-message skills", () => {
  afterEach(() => {
    vi.useRealTimers();
    evaluateDecisionPolicy.mockReset();
  });

  it("round-trips the activation flag through a saved skill document", () => {
    const document = buildSkillDocument({
      name: "house-style",
      description: "Write in the house style",
      instructions: "Use British English.",
      activation: "per-message",
    });

    expect(toSkillDefinition(parseSkillDocument(document).frontmatter).activation).toBe(
      "per-message",
    );
  });

  it("only offers short, ready skills that asked to be applied per message", () => {
    const skills = catalog({
      "house-style": buildSkillDocument({
        name: "house-style",
        description: "Write in the house style",
        instructions: "Use British English.",
        activation: "per-message",
      }),
      "long-style": buildSkillDocument({
        name: "long-style",
        description: "A long guide",
        instructions: "x".repeat(3_000),
        activation: "per-message",
      }),
      "on-demand": buildSkillDocument({
        name: "on-demand",
        description: "Loaded when needed",
        instructions: "Do the thing.",
      }),
    });

    const candidates = listPerMessageSkillCandidates(
      [
        availability("house-style", "per-message"),
        availability("long-style", "per-message"),
        availability("on-demand"),
      ],
      skills,
    );

    expect(candidates.map((candidate) => candidate.id)).toEqual(["house-style"]);
    expect(candidates.map((candidate) => candidate.body)).toEqual(["Use British English."]);
  });

  it("answers with no skills when the decision provider is too slow", async () => {
    vi.useFakeTimers();
    evaluateDecisionPolicy.mockReturnValue(new Promise(() => undefined));

    const selection = selectPerMessageSkills({
      env: {} as never,
      user: undefined,
      conversationId: "c1",
      message: "Draft the reply",
      candidates: [{ id: "house-style", name: "house-style", body: "Use British English." }],
    });

    await vi.advanceTimersByTimeAsync(2_000);

    await expect(selection).resolves.toEqual([]);
  });
});
