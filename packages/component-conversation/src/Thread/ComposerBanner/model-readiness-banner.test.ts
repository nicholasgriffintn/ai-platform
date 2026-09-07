// @vitest-environment node

import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildModelReadinessBanner } from "./model-readiness-banner.js";

const now = new Date("2026-09-05T10:00:00.000Z");

function model(readiness: unknown): ModelConfigItem {
  return {
    matchingModel: "gemma3:4b",
    provider: "ollama",
    readiness: readiness as ModelConfigItem["readiness"],
  };
}

function readinessPayload(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: 1,
    state: "unavailable",
    reasonCode: "runtime_unreachable",
    reason: "The runtime is not responding.",
    checkedAt: "2026-09-05T09:59:00.000Z",
    expiresAt: "2026-09-05T10:01:00.000Z",
    action: { kind: "open_runtimes", label: "Check again", path: "/downloads" },
    ...overrides,
  };
}

describe("buildModelReadinessBanner", () => {
  it("shows an unknown readiness reason without exposing an unknown action", () => {
    const banner = buildModelReadinessBanner(
      "ollama/gemma3:4b",
      model(
        readinessPayload({
          state: "unknown",
          reasonCode: "future_runtime_state",
          reason: "A newer runtime reported a state this client does not know.",
          action: { kind: "future_action", label: "Do something", path: "/future" },
        }),
      ),
      false,
      now,
    );

    expect(banner).toMatchObject({
      tone: "warning",
      title: "Model readiness is unknown",
      message: "A newer runtime reported a state this client does not know.",
    });
    expect(banner?.action).toBeUndefined();
  });

  it("keeps runtime setup and reachability actions distinct", () => {
    const notConfigured = buildModelReadinessBanner(
      "ollama/gemma3:4b",
      model(
        readinessPayload({
          state: "setup_required",
          reasonCode: "runtime_not_configured",
          reason: "Set up the Ollama runtime before using Gemma 3 4B.",
          action: { kind: "open_runtimes", label: "Set up", path: "/downloads" },
        }),
      ),
      false,
      now,
    );
    const unreachable = buildModelReadinessBanner(
      "ollama/gemma3:4b",
      model(readinessPayload()),
      false,
      now,
    );

    expect(notConfigured?.action).toEqual({
      label: "Set up",
      to: "/downloads",
    });
    expect(unreachable?.action).toEqual({
      label: "Check again",
      to: "/downloads",
    });
    expect(notConfigured?.message).not.toBe(unreachable?.message);
  });
});
