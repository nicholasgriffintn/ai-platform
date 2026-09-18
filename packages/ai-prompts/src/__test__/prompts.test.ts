import { describe, expect, it } from "vitest";

import {
  buildAssistantMetadataSection,
  buildFormattingSection,
  buildMemoryClassifierPrompt,
  buildMetaAssistantPrompt,
  buildSandboxReadErrorObservation,
  buildSkillsSection,
  buildStandardChatPrompt,
  getPrompt,
  getPromptForTask,
  getTextToImageSystemPrompt,
  PromptNotFoundError,
  renderPrompt,
  tryGetPrompt,
} from "../index.js";

describe("prompt retrieval", () => {
  it("gets prompts by id and task", () => {
    expect(getPrompt("chat/safety").id).toBe("chat/safety");
    expect(getPromptForTask("memory-normaliser").id).toBe("memory/normaliser");
    expect(tryGetPrompt("does/not-exist")).toBeUndefined();
    expect(() => getPrompt("does/not-exist" as never)).toThrow(PromptNotFoundError);
  });

  it("renders prompts with declared defaults", () => {
    expect(renderPrompt("chat/model-card", { modelId: "test-model" })).toContain(
      "<provider>unknown</provider>",
    );
  });
});

describe("chat builders", () => {
  it("builds a standard chat prompt with the expected sections", () => {
    const prompt = buildStandardChatPrompt({
      assistantName: "Polychat",
      assistantDescription: "A test assistant.",
      model: { modelId: "test-model", supportsToolCalls: true },
      mode: "agent",
      userContext: { date: "2026-08-20" },
      skills: [{ id: "artifacts", description: "Deliverables." }],
      persona: { name: "Release captain", instructions: "Confirm the changelog." },
    });

    expect(prompt).toContain("<assistant_identity>");
    expect(prompt).toContain("<model_card>");
    expect(prompt).toContain("<safety_standards>");
    expect(prompt).toContain("<agent_tool_workflow>");
    expect(prompt).toContain("<available_skills>");
    expect(prompt).toContain("Confirm the changelog.");
    expect(prompt).toContain("<current_date>2026-08-20</current_date>");
  });

  it("includes a model card with metadata and omits personas when absent", () => {
    const metadata = buildAssistantMetadataSection({
      assistantName: "Polychat",
      assistantDescription: "A test assistant.",
      model: {
        modelId: "test-model",
        provider: "openai",
        displayName: "Test Model",
        inputModalities: ["text"],
        outputModalities: ["text"],
        contextWindow: 200000,
        supportedCapabilities: ["tool_calls"],
      },
    });

    expect(metadata).toContain("<provider>openai</provider>");
    expect(metadata).toContain("<context_window>200000</context_window>");
    expect(metadata).toContain("<supported_capabilities>tool_calls</supported_capabilities>");
    expect(
      buildStandardChatPrompt({
        assistantName: "Polychat",
        assistantDescription: "A test assistant.",
        model: { modelId: "test-model" },
        userContext: { date: "2026-08-20" },
      }),
    ).not.toContain("<persona>");
  });

  it("selects the coding formatting variant", () => {
    expect(buildFormattingSection({ isCoding: true })).toContain(
      "Present runnable code in fenced blocks.",
    );
    expect(buildFormattingSection()).not.toContain("Present runnable code in fenced blocks.");
  });

  it("discloses skills with a load tool", () => {
    expect(buildSkillsSection([{ id: "council", description: "Run a council." }])).toContain(
      "call load_skill",
    );
    expect(buildSkillsSection([])).toBe("");
  });

  it("builds meta-assistant prompts with UI context labels", () => {
    const prompt = buildMetaAssistantPrompt({
      userReference: "Ada",
      uiContext: { mode: "chat", place: "you", conversationId: "c-1" },
    });

    expect(prompt).toContain("for Ada");
    expect(prompt).toContain("<mode>Chat</mode>");
    expect(prompt).toContain("<place>Account settings</place>");
    expect(prompt).toContain("<open_conversation_id>c-1</open_conversation_id>");
    expect(prompt).toContain("<safety_standards>");
  });
});

describe("assistant and provider builders", () => {
  it("builds the memory classifier prompt with absolute dates", () => {
    const prompt = buildMemoryClassifierPrompt({ date: new Date("2026-08-20T00:00:00Z") });

    expect(prompt).toContain("Today's date is Thursday, August 20, 2026");
    expect(prompt).toContain("User's green sofa is arriving on");
    expect(prompt).toContain("User's goal is to learn Spanish in 2026");
  });

  it("returns image style prompts with a default fallback", () => {
    expect(getTextToImageSystemPrompt("cyberpunk")).toContain("neon lighting");
    expect(getTextToImageSystemPrompt("unknown-style")).toBe(getTextToImageSystemPrompt());
  });

  it("builds sandbox observations", () => {
    expect(buildSandboxReadErrorObservation({ path: "a.ts", error: "nope" })).toContain(
      "File read failed for a.ts.",
    );
  });
});
