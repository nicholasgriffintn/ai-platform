import { generateKeyPairSync } from "node:crypto";

import type { D1Database } from "@cloudflare/workers-types";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { upsertGitHubConnectionForUser } from "~/modules/github/application/manage-connections";

import { databaseTestEnvironment } from "./environment";

export const knowledgeTestRepository = "company/handbook";
export const knowledgeCommit = "a".repeat(40);
export const knowledgeRoot = "b".repeat(40);
export const knowledgeFolder = "c".repeat(40);
export const knowledgeReadme = "d".repeat(40);
export const knowledgePolicy = "e".repeat(40);

export async function createKnowledgeContext(database: D1Database, userId = 42) {
  const context = createServiceContext({
    env: Object.assign(databaseTestEnvironment(database), {
      JWT_SECRET: "knowledge-test-sealing-key",
      TASK_QUEUE: { send: async () => undefined, sendBatch: async () => undefined },
    }),
  });
  const user = await context.repositories.users.getUserById(userId);

  if (!user) {
    throw new Error("Knowledge test user missing");
  }

  return createServiceContext({ env: context.env, user });
}

export async function seedKnowledgeUsers(database: D1Database) {
  await database.batch([
    database.prepare(
      "INSERT OR IGNORE INTO plans (id, name) VALUES ('free', 'Free'), ('pro', 'Pro')",
    ),
    database.prepare(
      "INSERT INTO user (id, email, plan_id) VALUES (42, 'owner@example.test', 'pro'), (43, 'reader@example.test', 'pro'), (44, 'outsider@example.test', 'pro')",
    ),
  ]);
}

export async function connectKnowledgeTestInstallation(
  context: Awaited<ReturnType<typeof createKnowledgeContext>>,
  userId = 42,
  installationId = 9,
) {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });

  await upsertGitHubConnectionForUser(context, userId, {
    installationId,
    appId: "test-app",
    privateKey: keys.privateKey.export({ format: "pem", type: "pkcs8" }),
    repositories: [knowledgeTestRepository],
  });
}

export async function createKnowledgeProject(
  context: Awaited<ReturnType<typeof createKnowledgeContext>>,
) {
  const workspaceId = generateId();

  await context.repositories.workspaces.createWorkspace({
    id: workspaceId,
    name: "Knowledge team",
    description: "",
    colour: "#000000",
    userId: 42,
  });
  const projectId = generateId();

  await context.env.DB.batch([
    context.env.DB.prepare(
      "INSERT INTO project (id, workspace_id, name, created_by) VALUES (?, ?, 'Handbook', 42)",
    ).bind(projectId, workspaceId),
    context.env.DB.prepare(
      "INSERT INTO workspace_member (workspace_id, user_id, role) VALUES (?, 43, 'member')",
    ).bind(workspaceId),
  ]);

  return { projectId, workspaceId };
}

export function knowledgeTestGitHub() {
  const calls: string[] = [];
  const controls = {
    deny: false,
    deleted: false,
    changed: false,
    truncated: false,
    interrupt: false,
    documents: 2,
    private: false,
    unsupportedFiles: false,
    calls,
  };
  const fetcher: typeof fetch = async (input, options) => {
    const request = new Request(input, options);
    const url = new URL(request.url);

    controls.calls.push(url.pathname);

    if (url.origin !== "https://api.github.com") {
      throw new Error("Unexpected knowledge request destination");
    }

    if (controls.deny) {
      return Response.json({}, { status: 403 });
    }

    if (url.pathname.endsWith("/access_tokens")) {
      const body = await request.json();

      if (
        JSON.stringify(body) !==
        JSON.stringify({ repositories: ["handbook"], permissions: { contents: "read" } })
      ) {
        throw new Error("Knowledge sync requested excess permissions");
      }

      return Response.json({ token: "test-read-token", permissions: { contents: "read" } });
    }

    if (url.pathname === "/repos/" + knowledgeTestRepository) {
      return Response.json({ private: controls.private, full_name: knowledgeTestRepository });
    }

    if (
      request.headers.has("authorization") &&
      request.headers.get("authorization") !== "Bearer test-read-token"
    ) {
      throw new Error("Unexpected repository credential");
    }

    if (url.pathname.includes("/commits/")) {
      return Response.json({ sha: knowledgeCommit, commit: { tree: { sha: knowledgeRoot } } });
    }

    if (url.pathname.endsWith("/git/trees/" + knowledgeRoot)) {
      return Response.json({
        sha: knowledgeRoot,
        truncated: false,
        tree: [
          { path: "docs", type: "tree", mode: "040000", sha: knowledgeFolder },
          { path: "secrets.txt", type: "blob", mode: "100644", size: 20, sha: "f".repeat(40) },
        ],
      });
    }

    if (url.pathname.endsWith("/git/trees/" + knowledgeFolder)) {
      return Response.json({
        sha: knowledgeFolder,
        truncated: controls.truncated,
        tree: Array.from({ length: controls.documents }, (_, index) => ({
          path: index === 0 ? "readme.md" : `policy-${index}.md`,
          type: "blob",
          mode: "100644",
          size: 24,
          sha: index === 0 ? knowledgeReadme : knowledgePolicy,
        })).filter((entry) => !controls.deleted || entry.path !== "readme.md"),
      });
    }

    if (url.pathname.includes("/contents/docs/")) {
      if (controls.interrupt) {
        throw new Error("Repository connection interrupted");
      }

      const readme = url.pathname.endsWith("/readme.md");

      if (readme && controls.deleted && url.searchParams.get("ref") === "main") {
        return Response.json({}, { status: 404 });
      }

      const content =
        controls.unsupportedFiles && url.pathname.endsWith("/policy-10.md")
          ? Buffer.from([0xff])
          : controls.unsupportedFiles && url.pathname.endsWith("/policy-11.md")
            ? Buffer.from("binary\u0000data")
            : Buffer.from(
                readme
                  ? "Handbook: never send credentials to a model."
                  : "Handbook policy: retain signed approval receipts.",
              );

      return Response.json({
        type: "file",
        encoding: "base64",
        size: content.byteLength,
        content: content.toString("base64"),
        sha: readme
          ? controls.changed && url.searchParams.get("ref") === "main"
            ? "f".repeat(40)
            : knowledgeReadme
          : knowledgePolicy,
      });
    }

    throw new Error("Unexpected repository content request");
  };

  return { controls, fetcher };
}
