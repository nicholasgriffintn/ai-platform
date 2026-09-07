import type { MachineHeartbeat } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { StoredMachine } from "~/repositories/MachineRepository";

import { heartbeatMachine, listMachines } from ".";

const heartbeat: MachineHeartbeat = {
  machineId: "machine-1",
  label: "Office desktop",
  platform: "macos",
  appVersion: "0.1.0",
  runtimes: [],
  capabilities: [],
};

function storedMachine(lastSeenAt: string): StoredMachine {
  return {
    userId: 42,
    ...heartbeat,
    lastSeenAt,
  };
}

function context(
  settings: { advertise_machines: boolean } | null,
  machines: Partial<{
    upsert: ReturnType<typeof vi.fn>;
    listForUser: ReturnType<typeof vi.fn>;
    deleteAllForUser: ReturnType<typeof vi.fn>;
    deleteForUser: ReturnType<typeof vi.fn>;
  }>,
): ServiceContext {
  return {
    getUserSettings: vi.fn().mockResolvedValue(settings),
    requireUser: () => ({ id: 42 }) as ServiceContext["user"],
    repositories: {
      machines: {
        upsert: machines.upsert ?? vi.fn().mockResolvedValue(undefined),
        listForUser: machines.listForUser ?? vi.fn().mockResolvedValue([]),
        deleteAllForUser: machines.deleteAllForUser ?? vi.fn().mockResolvedValue(undefined),
        deleteForUser: machines.deleteForUser ?? vi.fn().mockResolvedValue(undefined),
      },
    },
  } as unknown as ServiceContext;
}

describe("machine advertisement", () => {
  it("stores and returns an online account machine without connection details", async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const listForUser = vi.fn().mockResolvedValue([storedMachine("2026-09-07T09:00:00.000Z")]);
    const serviceContext = context({ advertise_machines: true }, { upsert, listForUser });

    const result = await heartbeatMachine(
      serviceContext,
      heartbeat,
      42,
      Date.parse("2026-09-07T09:01:00.000Z"),
    );

    expect(upsert).toHaveBeenCalledWith(42, heartbeat);
    expect(result).toMatchObject({
      machineId: "machine-1",
      online: true,
    });
    expect(result).not.toHaveProperty("url");
  });

  it("removes existing machines when advertising is disabled", async () => {
    const upsert = vi.fn();
    const deleteAllForUser = vi.fn().mockResolvedValue(undefined);
    const serviceContext = context({ advertise_machines: false }, { upsert, deleteAllForUser });

    await expect(heartbeatMachine(serviceContext, heartbeat, 42)).resolves.toBeNull();

    expect(deleteAllForUser).toHaveBeenCalledWith(42);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("derives online state from the five-minute freshness window", async () => {
    const serviceContext = context(
      { advertise_machines: true },
      {
        listForUser: vi.fn().mockResolvedValue([storedMachine("2026-09-07T08:54:59.000Z")]),
      },
    );

    const result = await listMachines(serviceContext, 42, Date.parse("2026-09-07T09:00:00.000Z"));

    expect(result[0]?.online).toBe(false);
  });
});
