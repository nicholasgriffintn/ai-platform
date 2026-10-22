import { describe, expect, it } from "vitest";

import type { StoredMachine } from "~/modules/machines/infrastructure/MachineRepository";

import { listDesktopWorkspaces, selectDesktopWorkspace } from "../desktop-tools";

const now = Date.parse("2026-10-19T10:00:00.000Z");

function machine(overrides: Partial<StoredMachine>): StoredMachine {
  return {
    userId: 1,
    machineId: "mac",
    label: "Polychat Desktop (macos)",
    platform: "macos",
    appVersion: "1.0.0",
    runtimes: [
      {
        kind: "local-tools",
        directories: [
          { id: "directory-1", label: "Notes" },
          { id: "directory-2", label: "Projects" },
        ],
      },
    ],
    capabilities: ["local-tools"],
    lastSeenAt: new Date(now - 60_000).toISOString(),
    ...overrides,
  };
}

describe("desktop workspaces", () => {
  it("only offers granted folders on online desktops that advertise local tools", () => {
    expect(listDesktopWorkspaces([machine({})], now)).toHaveLength(2);
    expect(
      listDesktopWorkspaces(
        [machine({ lastSeenAt: new Date(now - 10 * 60_000).toISOString() })],
        now,
      ),
    ).toEqual([]);
    expect(listDesktopWorkspaces([machine({ capabilities: ["model-run"] })], now)).toEqual([]);
  });

  it("selects by folder label, asks when several match and explains when none do", () => {
    const machines = [machine({})];

    expect(selectDesktopWorkspace(machines, { directory: "notes" }, now)).toMatchObject({
      status: "selected",
      workspace: { directory: { id: "directory-1" } },
    });
    expect(selectDesktopWorkspace(machines, {}, now)).toMatchObject({ status: "ambiguous" });
    expect(selectDesktopWorkspace(machines, { directory: "Downloads" }, now)).toMatchObject({
      status: "none",
    });
    expect(selectDesktopWorkspace([], {}, now)).toMatchObject({ status: "none" });
  });
});
