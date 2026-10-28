import type { AgentBilling, MachineRuntime } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import {
  MachineRepository,
  type StoredMachine,
} from "~/modules/machines/infrastructure/MachineRepository";
import { findModelConfig } from "~/modules/models/application/resolve";

import { chooseWorkMachineModel } from "../machine-routing";

vi.mock("~/modules/models/application/resolve", () => ({ findModelConfig: vi.fn() }));

const callMachineRun = vi.hoisted(() => vi.fn());

vi.mock("~/modules/machines/application/runs", () => ({ callMachineRun }));

function capacity(available: Record<string, number>) {
  callMachineRun.mockImplementation(async (_context: unknown, machineId: string) =>
    Response.json({
      active: 3 - (available[machineId] ?? 3),
      available: available[machineId] ?? 3,
    }),
  );
}

function agent(vendor: "claude-code" | "codex", billing: AgentBilling): MachineRuntime {
  return {
    kind: "agent",
    vendor,
    supportsSessions: true,
    readiness: { state: "ready", checkedAt: "2026-10-27T22:00:00Z", version: "2.1.300", billing },
  };
}

function machine(
  machineId: string,
  userId: number,
  runtimes: MachineRuntime[],
  lastSeenAt = new Date().toISOString(),
): StoredMachine {
  return {
    userId,
    machineId,
    label: machineId,
    platform: "macos",
    appVersion: "1.0.0",
    runtimes,
    capabilities: ["agent-run"],
    lastSeenAt,
  };
}

function context(shared: StoredMachine[]) {
  return Object.assign(Object.create(null), {
    env: {},
    repositories: fakeRepositories([
      [MachineRepository, { listSharedInWorkspace: vi.fn(async () => shared) }],
    ]),
  });
}

const params = { workspaceId: "ws", runnerIdentityUserId: 7, modelId: null };

describe("chooseWorkMachineModel", () => {
  it("prefers the run owner's desktop and only agents signed in with a subscription", async () => {
    capacity({});
    const choice = await chooseWorkMachineModel(
      context([
        machine("colleague-mac", 9, [agent("claude-code", "subscription")]),
        machine("keyed-mac", 7, [agent("claude-code", "api_key")]),
        machine("own-mac", 7, [agent("codex", "subscription")]),
      ]),
      params,
    );

    expect(choice).toBe("machine/own-mac/codex/codex");
  });

  it("passes over a desktop that is already running as many jobs as it can", async () => {
    capacity({ "own-mac": 0 });

    const choice = await chooseWorkMachineModel(
      context([
        machine("own-mac", 7, [agent("claude-code", "subscription")]),
        machine("colleague-mac", 9, [agent("claude-code", "subscription")]),
      ]),
      params,
    );

    expect(choice).toBe("machine/colleague-mac/claude-code/claude-code");
  });

  it("skips desktops that have gone offline", async () => {
    const choice = await chooseWorkMachineModel(
      context([
        machine("asleep", 7, [agent("claude-code", "subscription")], "2026-01-01T00:00:00Z"),
      ]),
      params,
    );

    expect(choice).toBeNull();
  });

  it("leaves a teammate that already runs on a machine or in the sandbox where it is", async () => {
    vi.mocked(findModelConfig).mockResolvedValueOnce({
      id: "sandbox",
      matchingModel: "sandbox",
      provider: "polychat-sandbox",
    });

    const choice = await chooseWorkMachineModel(
      context([machine("own-mac", 7, [agent("claude-code", "subscription")])]),
      { ...params, modelId: "sandbox" },
    );

    expect(choice).toBeNull();
  });
});
