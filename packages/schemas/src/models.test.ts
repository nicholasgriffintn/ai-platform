import { describe, expect, it } from "vitest";

import { getDefaultModelId } from "./model-selection.js";
import { decodeModelConfig } from "./models.js";

describe("model schemas", () => {
  it("keeps models readable when readiness contains an unknown code", () => {
    const models = decodeModelConfig({
      future: {
        matchingModel: "future-model",
        provider: "ollama",
        readiness: {
          protocolVersion: 1,
          state: "unknown",
          reasonCode: "future_runtime_state",
          reason: "A newer runtime reported a state this client does not know.",
          checkedAt: "2026-09-05T10:00:00.000Z",
          expiresAt: "2026-09-05T10:01:00.000Z",
          action: { kind: "future_action", label: "Do something", path: "/future" },
        },
      },
    });

    expect(models.future).toMatchObject({
      matchingModel: "future-model",
      readiness: {
        state: "unknown",
        reasonCode: "check_failed",
        reason: "A newer runtime reported a state this client does not know.",
      },
    });
    expect(models.future.readiness?.action).toBeUndefined();
  });

  it("uses only the server-published active default", () => {
    expect(
      getDefaultModelId({
        first: {
          matchingModel: "first",
          provider: "test",
        },
        selected: {
          matchingModel: "selected",
          provider: "test",
          isDefault: true,
          isExecutable: true,
        },
      }),
    ).toBe("selected");

    expect(
      getDefaultModelId({
        first: {
          matchingModel: "first",
          provider: "test",
        },
      }),
    ).toBeUndefined();

    expect(
      getDefaultModelId({
        retired: {
          matchingModel: "retired",
          provider: "test",
          deprecated: true,
          isDefault: true,
        },
      }),
    ).toBeUndefined();
  });
});
