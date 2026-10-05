import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { IEnv } from "~/types";

import { channelTestBinding, channelTestUser } from "../../../../../test/channels";
import { databaseTestEnvironment } from "../../../../../test/environment";
import { createChannelBinding } from "../bindings";

const requireProjectAccess = vi.hoisted(() =>
  vi.fn(async () => ({ project: { id: "project-1", workspace_id: "workspace-1" }, role: "admin" })),
);
const requireTeammateAccess = vi.hoisted(() => vi.fn(async () => ({ id: "teammate-1" })));

vi.mock("../slack-installation", () => ({
  validateSlackInstallation: vi.fn(async () => undefined),
}));

vi.mock("~/modules/workspaces/application/access", () => ({ requireProjectAccess }));
vi.mock("~/modules/teammates/application/access", () => ({ requireTeammateAccess }));

const USER_ID = 3;

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let env: IEnv;

beforeAll(async () => {
  env = databaseTestEnvironment(await runtime.getD1Database("DB"));
});
afterAll(() => runtime.dispose());

function createContext() {
  const context = createServiceContext({ env, user: { ...channelTestUser, id: USER_ID } });

  vi.spyOn(context.repositories.channelBindings, "findByExternalId").mockResolvedValue(null);
  vi.spyOn(context.repositories.channelBindings, "create").mockImplementation(async (record) => ({
    ...channelTestBinding,
    channel: record.channel,
    scope_type: record.scopeType,
    scope_id: record.scopeId,
    external_id: record.externalId,
    workspace_id: record.workspaceId,
    allowed_sender_ids: JSON.stringify(record.allowedSenderIds),
    reply_mode: record.replyMode,
    label: record.label,
    teammate_id: record.teammateId,
    interaction_mode: record.interactionMode,
    created_by: USER_ID,
  }));

  return context;
}

describe("createChannelBinding", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
        workspaceId: "T123",
        allowedSenderIds: ["U9"],
        teammateId: "someone-elses",
      }),
    ).rejects.toBeInstanceOf(AssistantError);
    expect(context.repositories.channelBindings.create).not.toHaveBeenCalled();
  });

  it("binds a teammate the caller can reach", async () => {
    const context = createContext();
    const binding = await createChannelBinding(context, {
      channel: "slack",
      externalId: "C123",
      workspaceId: "T123",
      allowedSenderIds: ["U9"],
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
