import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IBody, IUser, IUserSettings } from "~/types";
import { returnStandardPrompt } from "../standard";

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("~/utils/logger", () => ({
  getLogger: vi.fn(() => mockLogger),
}));

describe("returnStandardPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should generate prompt with minimal parameters", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(request);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should include session metadata and model information", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(
        request,
        undefined,
        undefined,
        false,
        false,
        false,
        false,
        { modelId: "test-model" },
      );
      expect(result).toContain("<session_metadata>");
      expect(result).toContain("<model_info>");
      expect(result).toContain("<model_id>test-model</model_id>");
    });
  });

  describe("parameter handling", () => {
    it("should use default mode when not provided", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(request);
      expect(result).toContain("assistant_info");
    });

    it("should handle agent mode", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { mode: "agent" };
      const result = await returnStandardPrompt(request);
      expect(result).toContain(
        "helpful agent with access to a range of powerful tools",
      );
    });

    it("should handle standard mode explicitly", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { mode: "standard" };
      const result = await returnStandardPrompt(request);
      expect(result).toContain("AI assistant helping with daily tasks");
    });

    it("should use default response_mode when not provided", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<response_traits>");
      expect(result).toContain("<response_preferences>");
    });

    it("should handle different response modes", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { response_mode: "concise" };
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<response_traits>");
      expect(result).toContain("<response_preferences>");
      expect(result).toContain("Favor brevity");
    });
  });

  describe("user context handling", () => {
    it("should include user nickname when provided", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      // @ts-expect-error - mock implementation
      const userSettings: IUserSettings = { nickname: "TestUser" };
      const result = await returnStandardPrompt(
        request,
        undefined,
        userSettings,
      );
      expect(result).toContain("<user_nickname>TestUser</user_nickname>");
    });

    it("should include user job role when provided", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      // @ts-expect-error - mock implementation
      const userSettings: IUserSettings = { job_role: "Developer" };
      const result = await returnStandardPrompt(
        request,
        undefined,
        userSettings,
      );
      expect(result).toContain("<user_job_role>Developer</user_job_role>");
    });

    it("should include current date", async () => {
      const testDate = "2024-01-01";
      // @ts-expect-error - mock implementation
      const request: IBody = { date: testDate };
      const result = await returnStandardPrompt(request);
      expect(result).toContain(`<current_date>${testDate}</current_date>`);
    });

    it("should use default date when not provided", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(request);
      const today = new Date().toISOString().split("T")[0];
      expect(result).toContain(`<current_date>${today}</current_date>`);
    });

    it("should include user location when provided", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {
        location: { latitude: 40.7128, longitude: -74.006 },
      };
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<user_location>");
      expect(result).toContain("<latitude>40.7128</latitude>");
      expect(result).toContain("<longitude>-74.006</longitude>");
    });

    it("should use user coordinates from user object when not in request", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const user: IUser = { latitude: 51.5074, longitude: -0.1278 } as IUser;
      const result = await returnStandardPrompt(request, user);
      expect(result).toContain("<latitude>51.5074</latitude>");
      expect(result).toContain("<longitude>-0.1278</longitude>");
    });

    it("should include preferred language when provided", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { lang: "es" };
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<preferred_language>es</preferred_language>");
      expect(result).toContain("Default to replying in es");
    });

    it("should include safety standards section", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<safety_standards>");
      expect(result).toContain(
        "Decline or redirect any requests that involve disallowed or dangerous content",
      );
    });

    it("should include instruction precedence block", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<instruction_precedence>");
      expect(result).toContain(
        "<order>system > safety_standards > assistant_principles > response_preferences > example_output</order>",
      );
    });
  });

  describe("feature flags handling", () => {
    it("should include thinking example when supportsReasoning is false", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(
        request,
        undefined,
        undefined,
        false,
        false,
        false,
      );
      expect(result).toContain("<think>");
    });

    it("should skip thinking example when supportsReasoning is true", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(
        request,
        undefined,
        undefined,
        false,
        false,
        true,
      );
      expect(result).not.toContain("<think>");
    });

    it("should include artifact example when supportsArtifacts is true", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(
        request,
        undefined,
        undefined,
        false,
        true,
        false,
      );
      expect(result).toContain("artifact");
    });

    it("should not include example output for agent mode when reasoning is supported", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { mode: "agent" };
      const result = await returnStandardPrompt(
        request,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      );
      expect(result).not.toContain("<example_output>");
    });

    it("should include compact example for agent mode when reasoning traces are unavailable", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { mode: "agent" };
      const result = await returnStandardPrompt(
        request,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        true,
      );

      expect(result).toContain("<example_output>");
      expect(result).toContain("<think>");
    });

    it("should derive supportsReasoning from model metadata when not provided", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(
        request,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          modelConfig: {
            supportsReasoning: true,
          } as any,
        },
      );
      expect(result).not.toContain("<think>");
    });
  });

  describe("agent mode specific features", () => {
    it("should include tool usage guidelines for agent mode", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { mode: "agent" };
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<tool_usage_guidelines>");
      expect(result).toContain("Analyze First");
      expect(result).toContain("Select Appropriately");
    });

    it("should include multi-step reasoning workflow for agent mode", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { mode: "agent" };
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<multi_step_reasoning_workflow>");
      expect(result).toContain("add_reasoning_step");
      expect(result).toContain("finalAnswer");
    });

    it("should include example workflow sequence for agent mode", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { mode: "agent" };
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<example_workflow_sequence>");
      expect(result).toContain("weather_lookup");
      expect(result).toContain("calculator");
    });

    it("should include tool availability information for agent mode", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { mode: "agent" };
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<tool_availability>");
      expect(result).toContain("settings icon in the bottom right corner");
    });
  });

  describe("memories handling", () => {
    it("should detect memories enabled from save setting", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      // @ts-expect-error - mock implementation
      const userSettings: IUserSettings = { memories_save_enabled: true };
      const result = await returnStandardPrompt(
        request,
        undefined,
        userSettings,
      );
      expect(result).toContain("<response_traits>");
    });

    it("should detect memories enabled from chat history setting", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      // @ts-expect-error - mock implementation
      const userSettings: IUserSettings = {
        memories_chat_history_enabled: true,
      };
      const result = await returnStandardPrompt(
        request,
        undefined,
        userSettings,
      );
      expect(result).toContain("<response_traits>");
    });
  });

  describe("user traits and preferences", () => {
    it("should pass user traits to response style", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      // @ts-expect-error - mock implementation
      const userSettings: IUserSettings = { traits: "custom traits" };
      const result = await returnStandardPrompt(
        request,
        undefined,
        userSettings,
      );
      expect(result).toContain("<response_traits>");
    });

    it("should pass user preferences to response style", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      // @ts-expect-error - mock implementation
      const userSettings: IUserSettings = { preferences: "custom preferences" };
      const result = await returnStandardPrompt(
        request,
        undefined,
        userSettings,
      );
      expect(result).toContain("<response_preferences>");
    });
  });

  describe("template structure", () => {
    it("should have proper XML structure", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<assistant_info>");
      expect(result).toContain("</assistant_info>");
      expect(result).toContain("<user_context>");
      expect(result).toContain("</user_context>");
      expect(result).toContain("<response_traits>");
      expect(result).toContain("</response_traits>");
      expect(result).toContain("<response_preferences>");
      expect(result).toContain("</response_preferences>");
    });

    it("should include example output structure for non-agent mode", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(request);
      expect(result).toContain("<example_output>");
      expect(result).toContain("<answer>");
      expect(result).toContain("</answer>");
      expect(result).toContain("</example_output>");
    });
  });

  describe("output consistency", () => {
    it("should produce consistent output for same inputs", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = { mode: "standard" };
      // @ts-expect-error - mock implementation
      const userSettings: IUserSettings = { nickname: "test" };
      const result1 = await returnStandardPrompt(
        request,
        undefined,
        userSettings,
      );
      const result2 = await returnStandardPrompt(
        request,
        undefined,
        userSettings,
      );
      expect(result1).toBe(result2);
    });

    it("should handle null/undefined user settings", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      const result = await returnStandardPrompt(request, undefined, undefined);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle empty user settings", async () => {
      // @ts-expect-error - mock implementation
      const request: IBody = {};
      // @ts-expect-error - mock implementation
      const userSettings: IUserSettings = {};
      const result = await returnStandardPrompt(
        request,
        undefined,
        userSettings,
      );
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
