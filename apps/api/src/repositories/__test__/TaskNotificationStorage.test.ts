import { readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";

import { TaskNotificationRepository } from "../TaskNotificationRepository";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let repository: TaskNotificationRepository;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");
  const migration = await readFile(
    new URL(
      "../../../migrations/0025_conversation_runs_and_task_notifications.sql",
      import.meta.url,
    ),
    "utf8",
  );

  await database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)").run();
  await database.prepare("INSERT INTO user VALUES (7), (8)").run();
  await database
    .prepare(`CREATE TABLE project_task (
    id TEXT PRIMARY KEY, project_id TEXT DEFAULT 'project-1', workspace_id TEXT DEFAULT 'workspace-1',
    attention_version INTEGER DEFAULT 1, objective TEXT DEFAULT 'Task', status TEXT DEFAULT 'running',
    blocked_reason TEXT, blocked_detail TEXT, assignee_user_id INTEGER, created_by_user_id INTEGER DEFAULT 7,
    conversation_id TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
  )`)
    .run();
  await database.prepare("INSERT INTO project_task (id) VALUES ('task-1')").run();
  await database.prepare("CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT)").run();
  await database.prepare("INSERT INTO project VALUES ('project-1', 'Project')").run();
  await database
    .prepare("CREATE TABLE workspace_member (workspace_id TEXT, user_id INTEGER)")
    .run();
  await database.prepare("INSERT INTO workspace_member VALUES ('workspace-1', 7)").run();
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (/CREATE (?:TABLE|(?:UNIQUE )?INDEX) `task_(?:notification_|inbox_)/.test(statement)) {
      await database.prepare(statement).run();
    }
  }

  repository = new TaskNotificationRepository({
    DB: database,
    PRIVATE_KEY: "isolated-notification-test-key",
  });
});

it("filters inbox eligibility and retains account receipts without changing task state", async () => {
  const database = await runtime.getD1Database("DB");

  await database
    .prepare(`INSERT INTO project_task (id, status, assignee_user_id, completed_at) VALUES
    ('decision', 'blocked', NULL, NULL),
    ('mine', 'backlog', 7, NULL),
    ('other', 'backlog', 8, NULL),
    ('recent', 'done', 7, datetime('now', '-29 days')),
    ('old', 'done', 7, datetime('now', '-31 days'))`)
    .run();
  expect((await repository.listInbox(7, 100)).map((entry) => entry.task_id).sort()).toEqual([
    "decision",
    "mine",
    "recent",
  ]);
  expect(await repository.listInbox(8, 100)).toEqual([]);
  expect(await repository.updateInboxReceipts(7, ["decision:v1"], "read")).toBe(1);
  expect(await repository.updateInboxReceipts(7, ["mine:v1"], "dismiss")).toBe(1);
  const reopened = new TaskNotificationRepository({
    DB: database,
    PRIVATE_KEY: "isolated-notification-test-key",
  });
  const inbox = await reopened.listInbox(7, 100);

  expect(inbox.map((entry) => entry.task_id).sort()).toEqual(["decision", "recent"]);
  expect(inbox.find((entry) => entry.task_id === "decision")?.read_at).not.toBeNull();
  expect(
    await database
      .prepare("SELECT status, assignee_user_id FROM project_task WHERE id = 'mine'")
      .first(),
  ).toEqual({ status: "backlog", assignee_user_id: 7 });
  await repository.updatePreferences(7, {
    enabled: false,
    decisions: false,
    failures: false,
    completions: false,
    assignments: false,
  });
  expect((await reopened.listInbox(7, 100)).map((entry) => entry.task_id).sort()).toEqual([
    "decision",
    "recent",
  ]);
  expect(await repository.createDeliveries("decision", 1, "decisions", [7])).toEqual([]);
  await repository.updatePreferences(7, {
    enabled: true,
    decisions: true,
    failures: true,
    completions: true,
    assignments: true,
  });
});

afterAll(async () => {
  await runtime.dispose();
});

it("replaces a token, recovers a failed registration and deduplicates each task version per installation", async () => {
  const initial = await repository.upsertRegistration(7, {
    platform: "web",
    installationId: "browser-1",
    subscription: {
      endpoint: "https://push.example.test/old",
      expirationTime: null,
      keys: { p256dh: "key", auth: "secret" },
    },
  });

  await repository.markRegistrationFailed(initial.id, "endpoint_expired");
  expect(await repository.createDeliveries("task-1", 1, "decisions", [7])).toEqual([]);
  const replacement = await repository.upsertRegistration(7, {
    platform: "web",
    installationId: "browser-1",
    subscription: {
      endpoint: "https://push.example.test/new",
      expirationTime: null,
      keys: { p256dh: "new-key", auth: "new-secret" },
    },
  });

  expect(replacement).toMatchObject({ id: initial.id, state: "registered", failureCode: null });
  const deliveries = await Promise.all([
    repository.createDeliveries("task-1", 1, "decisions", [7, 7]),
    repository.createDeliveries("task-1", 1, "decisions", [7]),
  ]);

  expect(deliveries.flat()).toHaveLength(1);
  const database = await runtime.getD1Database("DB");
  const stored = await database
    .prepare("SELECT destination_json FROM task_notification_registration WHERE id = ?")
    .bind(initial.id)
    .first<{ destination_json: string }>();

  expect(stored?.destination_json).not.toContain("push.example.test");
  expect(stored?.destination_json).not.toContain("new-secret");
  expect(await repository.listRegistrations(7)).toHaveLength(1);
});

it("moves an endpoint to its current account and removes only the signed-out installation", async () => {
  for (const installationId of ["device-a", "device-b"]) {
    await repository.upsertRegistration(7, {
      platform: "web",
      installationId,
      subscription: {
        endpoint: `https://push.example.test/${installationId}`,
        expirationTime: null,
        keys: { p256dh: "key", auth: "secret" },
      },
    });
  }

  await repository.upsertRegistration(8, {
    platform: "web",
    installationId: "device-a",
    subscription: {
      endpoint: "https://push.example.test/device-a",
      expirationTime: null,
      keys: { p256dh: "key", auth: "secret" },
    },
  });
  expect(
    (await repository.listRegistrations(7)).map((entry) => entry.installationId),
  ).not.toContain("device-a");
  await repository.removeRegistration(7, "device-b");
  expect(
    (await repository.listRegistrations(7)).map((entry) => entry.installationId),
  ).not.toContain("device-b");
  expect(await repository.listRegistrations(8)).toEqual([
    expect.objectContaining({ installationId: "device-a", state: "registered" }),
  ]);
});
