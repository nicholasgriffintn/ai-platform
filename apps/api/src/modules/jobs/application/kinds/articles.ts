import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { analyseArticle } from "~/modules/experiences/application/articles/analyse";
import { generateArticlesReport } from "~/modules/experiences/application/articles/generate-report";
import { summariseArticle } from "~/modules/experiences/application/articles/summarise";

import type { JobKindDefinition, JobKindView, JobScope, StartedJobs } from "../../domain/job-kind";
import { requireLatestScopedOutput, requireScopedOutput } from "../outputs";
import { outputJobFields } from "../present";

const ARTICLES_CAPABILITY = "articles";
const ARTICLES_PROJECT_CAPABILITY = "featured-article-processor";

async function startedArticleJob(
  scope: JobScope,
  present: JobKindView["present"],
  itemId: string,
  outputKind: string,
  outputId: string | undefined,
): Promise<StartedJobs> {
  const record = outputId
    ? await requireScopedOutput(scope, outputId)
    : await requireLatestScopedOutput(scope, ARTICLES_CAPABILITY, itemId, outputKind);
  const job = present(record);

  return { jobs: job ? [job] : [], rejected: [] };
}

export const articleAnalysisJobs: JobKindDefinition<"article_analysis"> = {
  kind: "article_analysis",
  outputCapability: ARTICLES_CAPABILITY,
  projectCapability: ARTICLES_PROJECT_CAPABILITY,
  requiredPlan: "pro",
  async start(scope, input) {
    const analysed = await analyseArticle({
      completion_id: generateId(),
      context: scope.context,
      args: input,
      app_url: undefined,
      user: scope.user,
      projectId: scope.projectId,
    });

    return startedArticleJob(
      scope,
      articleAnalysisJobs.present,
      input.itemId,
      "analysis",
      analysed.outputId,
    );
  },
  present(record) {
    return record.capability_id === ARTICLES_CAPABILITY && record.kind === "analysis"
      ? { ...outputJobFields(record), kind: "article_analysis" }
      : null;
  },
};

export const articleSummaryJobs: JobKindDefinition<"article_summary"> = {
  kind: "article_summary",
  outputCapability: ARTICLES_CAPABILITY,
  projectCapability: ARTICLES_PROJECT_CAPABILITY,
  requiredPlan: "pro",
  async start(scope, input) {
    const summarised = await summariseArticle({
      completion_id: generateId(),
      context: scope.context,
      args: input,
      app_url: undefined,
      user: scope.user,
      projectId: scope.projectId,
    });

    return startedArticleJob(
      scope,
      articleSummaryJobs.present,
      input.itemId,
      "summary",
      summarised.outputId,
    );
  },
  present(record) {
    return record.capability_id === ARTICLES_CAPABILITY && record.kind === "summary"
      ? { ...outputJobFields(record), kind: "article_summary" }
      : null;
  },
};

export const articleReportJobs: JobKindDefinition<"article_report"> = {
  kind: "article_report",
  outputCapability: ARTICLES_CAPABILITY,
  projectCapability: ARTICLES_PROJECT_CAPABILITY,
  requiredPlan: "pro",
  async start(scope, input) {
    const reported = await generateArticlesReport({
      completion_id: generateId(),
      context: scope.context,
      args: input,
      app_url: undefined,
      user: scope.user,
      projectId: scope.projectId,
    });

    return startedArticleJob(
      scope,
      articleReportJobs.present,
      input.itemId,
      "report",
      reported.outputId,
    );
  },
  present(record) {
    return record.capability_id === ARTICLES_CAPABILITY && record.kind === "report"
      ? { ...outputJobFields(record), kind: "article_report" }
      : null;
  },
};
