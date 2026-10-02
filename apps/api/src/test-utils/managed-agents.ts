import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";
import { createManagedAgentSessionSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

import { databaseTestEnvironment } from "./environment";

export const managedAgentTestInput = createManagedAgentSessionSchema.parse({
  agent: { model: "openai.gpt-5.6-luna", instructions: "Inspect the workspace" },
  environment: {
    type: "aws_bedrock_agentcore",
    runtime_arn: "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/test-runtime",
    workspace_directory: "/home/app/workspace",
    capability_directories: ["/opt/bma/plugins"],
  },
  role_arn: "arn:aws:iam::123456789012:role/BmaSession",
});

export function managedAgentTestUser(id = 42): IUser {
  return {
    id,
    name: "Test",
    email: `user-${id}@example.test`,
    avatar_url: null,
    github_username: null,
    company: null,
    site: null,
    location: null,
    bio: null,
    twitter_username: null,
    created_at: "2026-10-02T00:00:00Z",
    updated_at: "2026-10-02T00:00:00Z",
    setup_at: null,
    terms_accepted_at: null,
    plan_id: "pro",
  };
}

export function managedAgentTestContext(database: D1Database, userId = 42) {
  const env = databaseTestEnvironment(database);

  env.PRIVATE_KEY = Buffer.alloc(32, 1).toString("base64");
  env.BEDROCK_AWS_ACCESS_KEY = "platform-access";
  env.BEDROCK_AWS_SECRET_KEY = "platform-secret";

  return createServiceContext({
    env,
    user: managedAgentTestUser(userId),
  });
}

export async function initialiseManagedAgentsDatabase(database: D1Database): Promise<void> {
  await database.batch([
    database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)"),
    database.prepare(
      "CREATE TABLE conversation (id TEXT PRIMARY KEY, project_id TEXT, is_archived INTEGER)",
    ),
    database.prepare("CREATE TABLE project_capability (id TEXT PRIMARY KEY, project_id TEXT)"),
    database.prepare("INSERT INTO user VALUES (42), (43), (44), (99)"),
  ]);
  const baseline = await readFile(
    new URL("../../migrations/0000_baseline.sql", import.meta.url),
    "utf8",
  );
  const tables = [
    "workspace",
    "project",
    "workspace_member",
    "activity_record",
    "workspace_audit_record",
  ];

  for (const statement of baseline.split("--> statement-breakpoint")) {
    if (tables.some((table) => statement.trim().startsWith(`CREATE TABLE \`${table}\``))) {
      await database.prepare(statement).run();
    }
  }

  const connection = await readFile(
    new URL("../../migrations/0053_workspace_provider_connections.sql", import.meta.url),
    "utf8",
  );

  await database.prepare(connection).run();
  const platform = await readFile(
    new URL("../../migrations/0054_model_platform.sql", import.meta.url),
    "utf8",
  );
  const capabilities = platform
    .split("--> statement-breakpoint")
    .find((statement) =>
      statement.trim().startsWith("ALTER TABLE `workspace_provider_connection` ADD `capabilities`"),
    );

  if (!capabilities) {
    throw new Error("Missing workspace connection capabilities migration");
  }

  await database.prepare(capabilities).run();
  await database.batch([
    database.prepare(
      "INSERT INTO workspace (id, name, created_by) VALUES ('workspace-1', 'Workspace', 42)",
    ),
    database.prepare(
      "INSERT INTO project (id, workspace_id, name, created_by) VALUES ('project-1', 'workspace-1', 'Project', 42)",
    ),
    database.prepare(
      "INSERT INTO workspace_member (workspace_id, user_id, role) VALUES ('workspace-1', 42, 'owner'), ('workspace-1', 43, 'admin'), ('workspace-1', 44, 'member')",
    ),
  ]);
}
