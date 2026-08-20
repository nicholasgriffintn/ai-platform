import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/providers/models", () => ({
  getModelConfigByMatchingModel: vi.fn(async () => ({
    supportsToolCalls: true,
    contextWindow: 200000,
    modalities: { input: ["text"], output: ["text"] },
  })),
}));

import type { PromptRequest } from "..";
import { getSystemPrompt } from "..";

const request = {
  completion_id: "completion-1",
  input: "Hello",
  date: "2026-08-20",
  mode: "agent",
} as PromptRequest;

const skills = [
  {
    id: "artifacts",
    description: "Load when the user asks for a self-contained deliverable.",
    state: "ready",
  },
] as never;

describe("getSystemPrompt", () => {
  it("layers a saved agent's persona into the full prompt rather than replacing it", async () => {
    const prompt = await getSystemPrompt({
      request,
      model: "test-model",
      skills,
      persona: {
        name: "Release captain",
        instructions: "Always confirm the changelog before shipping.",
        examples: [{ input: "ship it", output: "Checking the changelog first." }],
      },
    });

    expect(prompt).toContain("Always confirm the changelog before shipping.");
    expect(prompt).toContain("Release captain");
    expect(prompt).toContain("ship it");
    expect(prompt).toContain("<safety_standards>");
    expect(prompt).toContain("<available_skills>");
    expect(prompt).toContain("<agent_tool_workflow>");
  });

  it("leaves the persona out entirely when there is none", async () => {
    const prompt = await getSystemPrompt({ request, model: "test-model" });

    expect(prompt).not.toContain("<persona>");
    expect(prompt).toContain("<safety_standards>");
  });
});
