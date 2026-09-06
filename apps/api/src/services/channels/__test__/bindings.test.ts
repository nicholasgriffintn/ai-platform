import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";

import { createChannelBinding } from "../bindings";

const requireProjectAccess = vi.hoisted(() =>
  vi.fn(async () => ({ project: { id: "project-1", workspace_id: "workspace-1" }, role: "admin" })),
);
const requireTeammateAccess = vi.hoisted(() => vi.fn(async () => ({ id: "teammate-1" })));

vi.mock("~/services/workspaces/access", () => ({ requireProjectAccess }));
vi.mock("~/services/teammates/access", () => ({ requireTeammateAccess }));

const USER_ID = 3;

function createContext() {
  const channelBindings = {
    getByExternalId: vi.fn(async () => null),
    create: vi.fn(async (record: Record<string, unknown>) => ({
      id: "binding-1",
      channel: record.channel,
      scope_type: record.scopeType,
      scope_id: record.scopeId,
      external_id: record.externalId,
      label: record.label,
      teammate_id: record.teammateId,
      created_by: USER_ID,
      enabled: true,
      created_at: "2026-09-01T00:00:00.000Z",
    })),
  };

  return {
    ensureDatabase: vi.fn(),
    requireUser: () => ({ id: USER_ID }),
    repositories: { channelBindings },
  } as unknown as ServiceContext;
}

describe("createChannelBinding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTeammateAccess.mockResolvedValue({ id: "teammate-1" });
  });

  it("refuses a teammate the caller cannot reach, so a channel cannot borrow one", async () => {
    const context = createContext();

    requireTeammateAccess.mockRejectedValueOnce(new AssistantError("Teammate not found"));

    await expect(
      createChannelBinding(context, {
        channel: "slack",
        externalId: "C123",
        teammateId: "someone-elses",
      }),
    ).rejects.toBeInstanceOf(AssistantError);
    expect(
      (context.repositories.channelBindings as unknown as { create: ReturnType<typeof vi.fn> })
        .create,
    ).not.toHaveBeenCalled();
  });

  it("binds a teammate the caller can reach", async () => {
    const context = createContext();
    const binding = await createChannelBinding(context, {
      channel: "slack",
      externalId: "C123",
      teammateId: "teammate-1",
    });

    expect(requireTeammateAccess).toHaveBeenCalledWith(
      expect.anything(),
      "teammate-1",
      "read",
      USER_ID,
    );
    expect(binding.teammateId).toBe("teammate-1");
  });
});
