import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type {
  ImportNotebookResearchInput,
  NotebookDetail,
  NotebookResearchResponse,
} from "@ngriffin_uk/polychat-schemas";
import { truncateForModel } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { runResearchReport } from "~/modules/research/application/report";
import { findWebResults } from "~/modules/search/application/results";
import { gatherKnowledgeArticles } from "~/modules/sources/application/knowledge/articles";
import { requireKnowledgeTarget } from "~/modules/sources/application/knowledge/targets";
import { createSource, toSourceSummary, updateSource } from "~/modules/sources/application/sources";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { requireNotebookAccess } from "./access";
import { enqueueNotebookJob } from "./jobs";
import { getNotebookDetail } from "./notebooks";

const logger = getLogger({ prefix: "notebooks/research" });
const MAX_SOURCE_CHARACTERS = 400_000;

export async function researchForNotebook(
  context: ServiceContext,
  notebookId: string,
  input: { query: string; depth: "fast" | "deep" },
): Promise<NotebookResearchResponse> {
  const user = context.requireUser();
  const { notebook } = await requireNotebookAccess(context, notebookId);

  if (input.depth === "fast") {
    return { depth: "fast", results: await findWebResults(context, input.query) };
  }

  const report = await createSource(context, user.id, {
    projectId: notebook.project_id,
    kind: "text",
    title: `Deep research: ${input.query}`.slice(0, 200),
    status: "processing",
    metadata: { research: { query: input.query, depth: "deep" } },
  });

  await context.repositories.get(SourceRepository).addCollectionSources(notebookId, [report.id]);
  await enqueueNotebookJob(context, notebook.project_id, {
    job: "research",
    notebookId,
    sourceId: report.id,
    query: input.query,
  });

  return { depth: "deep", report: toSourceSummary(report) };
}

export async function importNotebookResearch(
  context: ServiceContext,
  notebookId: string,
  input: ImportNotebookResearchInput,
  metadata: Record<string, unknown> = {},
): Promise<NotebookDetail> {
  const gathered = await gatherKnowledgeArticles(
    context,
    await requireKnowledgeTarget(context, { projectId: null, notebookId }, { manage: false }),
    input.results.map((result) => ({ title: result.title, url: result.url, snippet: "" })),
    { readLimit: input.results.length, summarise: false, metadata: () => metadata },
  );

  if (!gathered.some((article) => article.sourceId)) {
    throw new AssistantError("None of those pages had readable text", ErrorType.PARAMS_ERROR, 400);
  }

  return getNotebookDetail(context, notebookId);
}

export async function runNotebookResearch(
  context: ServiceContext,
  job: { notebookId: string; sourceId: string; query: string },
): Promise<void> {
  const user = context.requireUser();

  await requireNotebookAccess(context, job.notebookId);

  try {
    const report = await runResearchReport({
      env: context.env,
      user,
      query: job.query,
      depth: "deep",
    });
    const citations = report.citations.map((citation) => `- [${citation.title}](${citation.url})`);

    await updateSource(context, user.id, job.sourceId, {
      status: "available",
      content: truncateForModel(
        [report.markdown, citations.length ? `## Sources\n\n${citations.join("\n")}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        MAX_SOURCE_CHARACTERS,
      ),
    });

    if (report.citations.length > 0) {
      await importNotebookResearch(context, job.notebookId, {
        results: report.citations.slice(0, 20),
      }).catch((error: unknown) => {
        logger.warn("Cited pages could not be imported", { error, notebookId: job.notebookId });
      });
    }
  } catch (error) {
    await updateSource(context, user.id, job.sourceId, { status: "failed" });

    throw error;
  }
}
