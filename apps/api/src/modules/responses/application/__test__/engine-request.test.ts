import type { TeammateRunConfiguration } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { toEngineRequest } from "../engine-request";

const configuration: TeammateRunConfiguration = {
  teammateId: "teammate-123",
  behaviour: "colleague",
  persona: { name: "Researcher", instructions: "Answer carefully." },
  model: "mistral-large-latest",
  mode: "teammate",
  skillIds: [],
  enabledTools: ["run_council"],
  memoryBindings: [],
  mcpServers: [],
  connectionGrants: [],
  maxSteps: 20,
  usedSteps: 0,
};

describe("toEngineRequest", () => {
  it("refuses server-only fields smuggled into the command settings", () => {
    for (const settings of [
      { trigger: "schedule" },
      { resolved_configuration: configuration },
      { command_payload: { stageId: "stage-1" } },
      { require_approval_for: [] },
    ]) {
      expect(() =>
        toEngineRequest({
          messages: [{ role: "user", content: "Hello" }],
          settings: settings as never,
        }),
      ).toThrow();
    }
  });
});
