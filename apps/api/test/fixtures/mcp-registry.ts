import { createServiceContext } from "~/infrastructure/context/serviceContext";

import { createMigratedTestDatabase } from "../helpers/database";
import { databaseTestEnvironment } from "../helpers/environment";

export async function createMcpRegistryFixture() {
  const { runtime, database } = await createMigratedTestDatabase();

  await database.batch([
    database.prepare("INSERT OR IGNORE INTO plans (id, name) VALUES ('pro', 'Pro')"),
    database.prepare(
      "INSERT INTO user (id, email, plan_id) VALUES (42, 'mcp-owner@example.test', 'pro'), (43, 'mcp-member@example.test', 'pro'), (44, 'mcp-outsider@example.test', 'pro')",
    ),
  ]);
  const env = Object.assign(databaseTestEnvironment(database), {
    JWT_SECRET: "mcp-fixture-encryption",
  });
  const anonymous = createServiceContext({ env });
  const contexts = await Promise.all(
    [42, 43, 44].map(async (id) => {
      const user = await anonymous.repositories.users.getUserById(id);

      if (!user) {
        throw new Error("MCP fixture user is missing");
      }

      return createServiceContext({ env, user });
    }),
  );
  const [owner, member, outsider] = contexts;
  const workspaceId = "mcp-fixture-workspace";
  const projectId = "mcp-fixture-project";

  await owner.repositories.workspaces.createWorkspace({
    id: workspaceId,
    userId: 42,
    name: "MCP workspace",
    description: "",
    colour: "#000000",
  });
  await database
    .prepare("INSERT INTO workspace_member (workspace_id, user_id, role) VALUES (?, 43, 'member')")
    .bind(workspaceId)
    .run();
  await owner.repositories.workspaces.createProject({
    id: projectId,
    workspaceId,
    createdBy: 42,
    name: "MCP project",
    description: "",
    instructions: "",
    colour: "#000000",
  });

  return { runtime, database, owner, member, outsider, workspaceId, projectId };
}
