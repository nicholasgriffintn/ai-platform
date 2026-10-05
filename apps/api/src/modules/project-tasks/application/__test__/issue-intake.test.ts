import {
  createComposioToolSession,
  deleteComposioToolSession,
  executeComposioSessionTool,
  listComposioConnectedAccounts,
} from "@ngriffin_uk/polychat-ai-integrations";
import { importProjectIssueSchema } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { getRecipeConnectorProviderConfig } from "~/modules/apps/application/connectors/connector-adapters";
import { updateSource, deleteSource } from "~/modules/sources/application/sources";

import { createIntegrationTestContext } from "../../../../../test/helpers/project-task-integrations";
import { importProjectIssue, previewProjectIssue } from "../issue-intake";
import { buildProjectTaskContext } from "../source-context";

vi.mock("~/modules/project-tasks/application/attention", () => ({
  reconcileTaskNotifications: vi.fn(),
}));
vi.mock("@ngriffin_uk/polychat-ai-integrations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-integrations")>()),
  createComposioToolSession: vi.fn(),
  deleteComposioToolSession: vi.fn(),
  executeComposioSessionTool: vi.fn(),
  listComposioConnectedAccounts: vi.fn(),
}));

let fixture: Awaited<ReturnType<typeof createIntegrationTestContext>>;
const locator = { provider: "linear", accountId: "account-1", issueId: "ENG-42" } as const;
const upstream = {
  id: "issue-42",
  identifier: "ENG-42",
  title: "Preserve filters",
  description: "Selected filters must survive refresh.",
  url: "https://linear.app/example/issue/ENG-42",
  updatedAt: "2026-10-04T00:00:00Z",
};

beforeEach(async () => {
  vi.clearAllMocks();
  fixture = await createIntegrationTestContext();
  const provider = getRecipeConnectorProviderConfig("linear");
  const authConfigId = provider?.operations.find(
    (operation) => operation.id === "LINEAR_GET_LINEAR_ISSUE",
  )?.authConfigIds?.[0];

  if (!authConfigId) {
    throw new Error("Linear issue reading is not configured");
  }

  vi.mocked(listComposioConnectedAccounts).mockResolvedValue([
    {
      id: "account-1",
      userId: "test-user-7",
      toolkitSlug: "linear",
      authConfigId,
      status: "ACTIVE",
      isDisabled: false,
      createdAt: "2026-10-04T00:00:00Z",
      updatedAt: "2026-10-04T00:00:00Z",
    },
  ]);
  vi.mocked(createComposioToolSession).mockImplementation(async () => generateId());
  vi.mocked(deleteComposioToolSession).mockResolvedValue(undefined);
  vi.mocked(executeComposioSessionTool).mockResolvedValue({
    data: { issue: upstream },
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fixture?.runtime.dispose();
});

describe("issue intake through the existing task and source services", () => {
  it("imports approved criteria, preserves a snapshot and reuses the same external identity", async () => {
    const preview = await previewProjectIssue(fixture.context, "project-1", locator);
    const input = importProjectIssueSchema.parse({
      locator,
      expectedRevision: preview.issue.revision,
      task: {
        objective: "Preserve selected filters after refresh",
        acceptanceCriteria: [{ text: "Selected filters survive a page refresh." }],
      },
    });
    const imported = await importProjectIssue(fixture.context, "project-1", input);
    const duplicate = await importProjectIssue(fixture.context, "project-1", input);

    expect(duplicate).toMatchObject({
      reused: true,
      task: { id: imported.task.id },
      sourceId: imported.sourceId,
    });
    expect(imported.task.acceptanceCriteria[0]?.text).toBe(
      input.task.acceptanceCriteria?.[0]?.text,
    );
    expect(await buildProjectTaskContext(fixture.context, imported.task)).toContain(
      upstream.description,
    );
    await expect(
      updateSource(fixture.context, 7, imported.sourceId, { content: "rewritten" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(deleteSource(fixture.context, 7, imported.sourceId)).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(
      fixture.database
        .prepare("UPDATE source SET content = 'rewritten' WHERE id = ?")
        .bind(imported.sourceId)
        .run(),
    ).rejects.toThrow("immutable");
    expect(executeComposioSessionTool).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        connectedAccountId: locator.accountId,
        toolSlug: "LINEAR_GET_LINEAR_ISSUE",
        arguments: { issue_id: locator.issueId },
      }),
    );
    expect(deleteComposioToolSession).toHaveBeenCalled();
    expect(
      (
        await fixture.database
          .prepare("SELECT project_id, conversation_id FROM activity_record")
          .all()
      ).results,
    ).toEqual([
      { project_id: "project-1", conversation_id: null },
      { project_id: "project-1", conversation_id: null },
      { project_id: "project-1", conversation_id: null },
    ]);
    expect(
      (await fixture.database.prepare("SELECT id FROM composio_connector_session").all()).results,
    ).toEqual([]);
  });

  it("rejects changed issue content before creating a task", async () => {
    const preview = await previewProjectIssue(fixture.context, "project-1", locator);

    vi.mocked(executeComposioSessionTool).mockResolvedValue({
      data: {
        issue: { ...upstream, description: "A new requirement", updatedAt: "2026-10-04T01:00:00Z" },
      },
    });
    await expect(
      importProjectIssue(
        fixture.context,
        "project-1",
        importProjectIssueSchema.parse({
          locator,
          expectedRevision: preview.issue.revision,
          task: { objective: "Fix filters" },
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await fixture.context.repositories.projectTasks.listProjectTasks("project-1")).toEqual(
      [],
    );
  });

  it("rechecks membership before reading credentials", async () => {
    await fixture.database.prepare("DELETE FROM workspace_member WHERE user_id = 7").run();
    await expect(previewProjectIssue(fixture.context, "project-1", locator)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(listComposioConnectedAccounts).not.toHaveBeenCalled();
    expect(executeComposioSessionTool).not.toHaveBeenCalled();
  });

  it("cleans up a connector session when the provider response is invalid", async () => {
    vi.mocked(executeComposioSessionTool).mockResolvedValue({
      data: { issue: null },
    });
    await expect(previewProjectIssue(fixture.context, "project-1", locator)).rejects.toThrow();
    expect(deleteComposioToolSession).toHaveBeenCalled();
  });

  it("handles simultaneous imports without creating duplicate tasks", async () => {
    const preview = await previewProjectIssue(fixture.context, "project-1", locator);
    const input = importProjectIssueSchema.parse({
      locator,
      expectedRevision: preview.issue.revision,
      task: { objective: "Fix filters" },
    });
    const results = await Promise.all(
      Array.from({ length: 2 }, () =>
        importProjectIssue(
          createServiceContext({
            env: fixture.context.env,
            user: fixture.context.requireUser(),
          }),
          "project-1",
          input,
        ),
      ),
    );

    expect(results[0].task.id).toBe(results[1].task.id);
    expect(
      await fixture.context.repositories.projectTasks.listProjectTasks("project-1"),
    ).toHaveLength(1);
    expect(results.filter((result) => result.reused)).toHaveLength(1);
    const audit = await fixture.database
      .prepare(
        "SELECT action, COUNT(*) AS total FROM workspace_audit_record WHERE action IN ('project.task.created', 'source.created') GROUP BY action ORDER BY action",
      )
      .all();

    expect(audit.results).toEqual([
      { action: "project.task.created", total: 1 },
      { action: "source.created", total: 1 },
    ]);
  });
});
