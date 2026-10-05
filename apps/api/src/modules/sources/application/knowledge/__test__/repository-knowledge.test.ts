import { afterEach, describe, expect, it, vi } from "vitest";

import { search_documents } from "~/modules/functions/application/search_documents";
import { deleteGitHubConnectionForUser } from "~/modules/github/application/manage-connections";
import {
  controlKnowledgeSync,
  createKnowledgeSync,
  deleteKnowledgeSync,
} from "~/modules/sources/application/knowledge/connections";
import { searchKnowledge } from "~/modules/sources/application/knowledge/search";
import { runKnowledgeSync } from "~/modules/sources/application/knowledge/sync";
import {
  getSource,
  listProjectConversationSources,
  setProjectContextSources,
} from "~/modules/sources/application/sources";

import {
  connectKnowledgeTestInstallation,
  createKnowledgeContext,
  createKnowledgeProject,
  knowledgeTestGitHub,
  knowledgeTestRepository,
  seedKnowledgeUsers,
} from "../../../../../../test/fixtures/repository-knowledge";
import { createMigratedTestDatabase } from "../../../../../../test/helpers/database";

describe("repository knowledge boundaries", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resumes durable progress, hides changed/deleted content and purges only after a complete scan", async () => {
    const { runtime, database } = await createMigratedTestDatabase();

    try {
      await seedKnowledgeUsers(database);
      const context = await createKnowledgeContext(database);

      await connectKnowledgeTestInstallation(context);
      const github = knowledgeTestGitHub();

      vi.stubGlobal("fetch", github.fetcher);
      github.controls.documents = 12;
      github.controls.unsupportedFiles = true;
      const sync = await createKnowledgeSync(context, {
        repository: knowledgeTestRepository,
        branch: "main",
        path: "docs",
        installationId: 9,
      });

      await runKnowledgeSync(context, sync.id);
      const progress = await context.repositories.repositoryKnowledgeSyncs.get(sync.id);

      expect(progress?.status).toBe("syncing");
      expect(progress?.checkpoint).toBeTruthy();
      github.controls.interrupt = true;
      await runKnowledgeSync(await createKnowledgeContext(database), sync.id);
      const interrupted = await context.repositories.repositoryKnowledgeSyncs.get(sync.id);

      expect(interrupted?.status).toBe("failed");
      expect(interrupted?.checkpoint).toBe(progress?.checkpoint);
      expect(interrupted?.document_count).toBe(progress?.document_count);
      github.controls.interrupt = false;
      await runKnowledgeSync(await createKnowledgeContext(database), sync.id);
      expect(
        (await context.repositories.repositoryKnowledgeSyncs.get(sync.id))?.document_count,
      ).toBe(10);
      expect((await context.repositories.repositoryKnowledgeSyncs.get(sync.id))?.status).toBe(
        "idle",
      );
      const response = await searchKnowledge(context, { query: "credentials", limit: 5 });

      expect(response.results[0]?.excerpt).toContain("never send credentials");
      const sourceId = response.results[0].sourceId;

      github.controls.changed = true;
      expect((await searchKnowledge(context, { query: "credentials", limit: 5 })).results).toEqual(
        [],
      );
      github.controls.changed = false;
      github.controls.deleted = true;
      await expect(getSource(context, 42, sourceId)).rejects.toMatchObject({ statusCode: 404 });
      const current = await context.repositories.repositoryKnowledgeSyncs.get(sync.id);

      await controlKnowledgeSync(context, sync.id, { action: "sync", revision: current.revision });
      github.controls.truncated = true;
      await runKnowledgeSync(context, sync.id);
      expect(await context.repositories.sources.getSource(sourceId)).not.toBeNull();
      github.controls.truncated = false;
      const blocked = await context.repositories.repositoryKnowledgeSyncs.get(sync.id);

      await controlKnowledgeSync(context, sync.id, {
        action: "resume",
        revision: blocked.revision,
      });
      await runKnowledgeSync(context, sync.id);
      await runKnowledgeSync(context, sync.id);
      expect(await context.repositories.sources.getSource(sourceId)).toBeNull();
      await deleteKnowledgeSync(context, sync.id);
      expect(
        await database
          .prepare("SELECT COUNT(*) AS count FROM source WHERE provider = 'github-knowledge'")
          .first("count"),
      ).toBe(0);
    } finally {
      await runtime.dispose();
    }
  }, 30_000);

  it("excludes private repository content from shared project history and never shares a personal import", async () => {
    const { runtime, database } = await createMigratedTestDatabase();

    try {
      await seedKnowledgeUsers(database);
      const owner = await createKnowledgeContext(database);
      const reader = await createKnowledgeContext(database, 43);
      const { projectId } = await createKnowledgeProject(owner);

      await connectKnowledgeTestInstallation(owner);
      const github = knowledgeTestGitHub();

      vi.stubGlobal("fetch", github.fetcher);
      const sync = await createKnowledgeSync(owner, {
        projectId,
        repository: knowledgeTestRepository,
        branch: "main",
        path: "docs",
        installationId: 9,
      });

      await runKnowledgeSync(owner, sync.id);
      const results = await searchKnowledge(owner, { projectId, query: "credentials", limit: 5 });
      const sourceId = results.results[0].sourceId;

      expect(await owner.repositories.sourceSearch.getSource(sourceId)).toBeNull();
      expect(await owner.repositories.sourceSearch.maintenance(false, false)).not.toContainEqual(
        expect.objectContaining({ id: sourceId }),
      );

      await setProjectContextSources(owner, 42, projectId, [sourceId]);
      expect(
        (await searchKnowledge(reader, { projectId, query: "credentials", limit: 5 })).results,
      ).toHaveLength(1);
      const toolResult = await search_documents.execute(
        { query: "credentials" },
        {
          completionId: "knowledge-search",
          env: reader.env,
          request: {
            env: reader.env,
            user: reader.requireUser(),
            context: reader,
            memoryScope: { type: "project", projectId },
          },
        },
      );

      expect(toolResult.content).toContain("https://github.com/company/handbook/blob/");
      github.controls.private = true;
      expect((await listProjectConversationSources(reader, 43, projectId)).sources).toEqual([]);
      await expect(
        createKnowledgeSync(owner, {
          projectId,
          repository: knowledgeTestRepository,
          branch: "main",
          path: "docs",
          installationId: 9,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      const personal = await createKnowledgeSync(owner, {
        repository: knowledgeTestRepository,
        branch: "main",
        path: "docs",
        installationId: 9,
      });

      await runKnowledgeSync(owner, personal.id);
      expect((await searchKnowledge(reader, { query: "credentials", limit: 5 })).results).toEqual(
        [],
      );
      const privateResults = await searchKnowledge(owner, { query: "credentials", limit: 5 });

      expect(privateResults.results).toHaveLength(1);
      await deleteGitHubConnectionForUser(owner, 42, 9);
      expect((await searchKnowledge(owner, { query: "credentials", limit: 5 })).results).toEqual(
        [],
      );
      github.controls.deny = true;
      expect((await listProjectConversationSources(owner, 42, projectId)).sources).toEqual([]);
    } finally {
      await runtime.dispose();
    }
  }, 30_000);

  it("fences a worker after pause or removal of its owner's project authority", async () => {
    const { runtime, database } = await createMigratedTestDatabase();

    try {
      await seedKnowledgeUsers(database);
      const context = await createKnowledgeContext(database);
      const { projectId, workspaceId } = await createKnowledgeProject(context);

      await connectKnowledgeTestInstallation(context);
      const github = knowledgeTestGitHub();

      vi.stubGlobal("fetch", github.fetcher);
      const sync = await createKnowledgeSync(context, {
        projectId,
        repository: knowledgeTestRepository,
        branch: "main",
        path: "docs",
        installationId: 9,
      });
      const lease = await context.repositories.repositoryKnowledgeSyncs.claim(
        sync.id,
        42,
        "worker-lease",
      );

      await controlKnowledgeSync(context, sync.id, { action: "pause", revision: sync.revision });
      await expect(
        context.repositories.repositoryKnowledgeSyncs.saveCheckpoint(lease, "{}"),
      ).rejects.toMatchObject({ statusCode: 409 });
      await database
        .prepare("DELETE FROM workspace_member WHERE workspace_id = ? AND user_id = 42")
        .bind(workspaceId)
        .run();
      await expect(
        controlKnowledgeSync(context, sync.id, { action: "resume", revision: sync.revision + 1 }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(
        await context.repositories.repositoryKnowledgeSyncs.claim(sync.id, 42, "old-owner"),
      ).toBeNull();
    } finally {
      await runtime.dispose();
    }
  }, 30_000);
});
