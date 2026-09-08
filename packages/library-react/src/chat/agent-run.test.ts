import { agentModelConfig } from "@ngriffin_uk/polychat-schemas";
import { expect, it, vi } from "vitest";

import { createFakeDesktopBackend } from "../lib/testing/desktop-backend.js";
import { streamAgentProcessRun } from "./agent-run.js";

it.each(["cancel-picker", "abort-run"])(
  "does not grant a workspace or start an agent after %s",
  async (cancellation) => {
    const backend = createFakeDesktopBackend();
    const controller = new AbortController();
    const onStatus = vi.fn();

    backend.probeAgentTool = async () => ({
      state: "ready",
      checkedAt: "2026-09-08T10:00:00Z",
      version: "1.0.0",
    });
    backend.pickAgentDirectory = async () => {
      expect(onStatus).toHaveBeenCalledOnce();
      if (cancellation === "cancel-picker") {
        return null;
      }

      controller.abort();

      return "/tmp/project";
    };

    const save = vi.spyOn(backend, "saveAgentDirectory");
    const start = vi.spyOn(backend, "startAgentProcessRun");

    await expect(
      streamAgentProcessRun({
        backend,
        conversationId: "conversation-1",
        model: agentModelConfig["agent/claude-code"],
        messages: [{ id: "message-1", role: "user", content: "Hello" }],
        permissionMode: "full_access",
        signal: controller.signal,
        onContent: vi.fn(),
        onStatus,
      }),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  },
);
