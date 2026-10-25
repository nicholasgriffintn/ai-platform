import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type {
  ImportNotebookResearchInput,
  NotebookDetail,
  NotebookResearchResponse,
  NotebookResearchResult,
} from "@ngriffin_uk/polychat-schemas";
import {
  publishedCalendarDate,
  readUrlHost,
  truncateForModel,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { runResearchReport } from "~/modules/research/application/report";
import { handleWebSearch } from "~/modules/search/application/web";
import { createSource, toSourceSummary, updateSource } from "~/modules/sources/application/sources";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";
import { extractContent } from "~/modules/tools/application/retrieval/content-extract";

import { requireNotebookAccess } from "./access";
import { enqueueNotebookJob } from "./jobs";
import { getNotebookDetail } from "./notebooks";

const logger = getLogger({ prefix: "notebooks/research" });
const FAST_RESEARCH_LIMIT = 10;
const MAX_SOURCE_CHARACTERS = 400_000;

export async function findWebResults(
  context: ServiceContext,
  query: string,
): Promise<NotebookResearchResult[]> {
  const response = await handleWebSearch({ env: context.env, user: context.requireUser(), query });
  const seen = new Set<string>();
  const results: NotebookResearchResult[] = [];

  for (const source of response.data.sources) {
    if (!source.url || seen.has(source.url)) {
      continue;
    }

    seen.add(source.url);
    results.push({
      title: (source.title || source.url).slice(0, 200),
      url: source.url,
      snippet: source.content.slice(0, 1_000),
    });
  }

  return results.slice(0, FAST_RESEARCH_LIMIT);
}

export interface NewsResult extends NotebookResearchResult {
  source: string;
  date: string;
}

export async function findNewsResults(
  context: ServiceContext,
  query: string,
  days: number,
  now = Date.now(),
): Promise<NewsResult[]> {
  const response = await handleWebSearch({
    env: context.env,
    user: context.requireUser(),
    query,
    options: { topic: "news", days, max_results: FAST_RESEARCH_LIMIT },
  });
  const seen = new Set<string>();
  const results: NewsResult[] = [];

  for (const source of response.data.sources) {
    if (!source.url || seen.has(source.url)) {
      continue;
    }

    seen.add(source.url);
    results.push({
      title: (source.title || source.url).slice(0, 200),
      url: source.url,
      snippet: source.content.slice(0, 1_000),
      source: (source.publisher || readUrlHost(source.url)).slice(0, 80),
      date: publishedCalendarDate(source.publishedDate, now),
    });
  }

  return results.slice(0, FAST_RESEARCH_LIMIT);
}

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

async function createWebSources(
  context: ServiceContext,
  projectId: string | null,
  results: ImportNotebookResearchInput["results"],
  metadata: Record<string, unknown>,
): Promise<string[]> {
  const user = context.requireUser();
  const extracted = await extractContent(
    { urls: results.map((result) => result.url) },
    { env: context.env, user, context },
  );

  if (extracted.status === "error" || !extracted.data) {
    throw new AssistantError(
      extracted.error ?? "Those pages could not be read",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  const contentByUrl = new Map(
    extracted.data.extracted.results.map((page) => [page.url, page.raw_content]),
  );
  const sourceIds: string[] = [];

  for (const result of results) {
    const content = contentByUrl.get(new URL(result.url).toString());

    if (!content?.trim()) {
      continue;
    }

    const source = await createSource(context, user.id, {
      projectId,
      kind: "url",
      title: result.title,
      status: "available",
      content: truncateForModel(content, MAX_SOURCE_CHARACTERS),
      externalUri: result.url,
      provider: "web",
      metadata,
    });

    sourceIds.push(source.id);
  }

  return sourceIds;
}

export async function importNotebookResearch(
  context: ServiceContext,
  notebookId: string,
  input: ImportNotebookResearchInput,
  metadata: Record<string, unknown> = {},
): Promise<NotebookDetail> {
  const access = await requireNotebookAccess(context, notebookId);
  const sourceIds: string[] = [];

  for (let start = 0; start < input.results.length; start += 10) {
    sourceIds.push(
      ...(await createWebSources(
        context,
        access.notebook.project_id,
        input.results.slice(start, start + 10),
        metadata,
      )),
    );
  }

  if (sourceIds.length === 0) {
    throw new AssistantError("None of those pages had readable text", ErrorType.PARAMS_ERROR, 400);
  }

  await context.repositories.get(SourceRepository).addCollectionSources(notebookId, sourceIds);

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
