import {
  articleAnalyzeSchema,
  articleDetailResponseSchema,
  articleSummariseSchema,
  contentExtractSchema,
  listPageOf,
  sourceArticlesResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { requestAppUrl } from "@ngriffin_uk/polychat-utility-server/urls";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import { analyseArticle } from "~/modules/experiences/application/articles/analyse";
import { generateArticlesReport } from "~/modules/experiences/application/articles/generate-report";
import { getArticleDetails } from "~/modules/experiences/application/articles/get-details";
import { getSourceArticles } from "~/modules/experiences/application/articles/get-source-articles";
import { listArticles } from "~/modules/experiences/application/articles/list";
import {
  cleanupArticleSession,
  summariseArticle,
} from "~/modules/experiences/application/articles/summarise";
import { extractContent } from "~/modules/tools/application/retrieval/content-extract";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import { proExperience } from "./access";

const articleParamsSchema = z.object({ article_id: z.string().min(1) });
const reportParamsSchema = z.object({ report_id: z.string().min(1) });
const sourcesQuerySchema = projectScopeQuerySchema.extend({
  ids: z.union([z.string().min(1), z.array(z.string().min(1))]),
});
const access = proExperience("featured-article-processor");

export function defineArticles(app: HonoLike): void {
  defineResource(
    app,
    { path: "/articles", idParam: "article_id", tags: ["experiences"] },
    (articles) => {
      articles
        .list({
          auth: true,
          summary: "List article sessions",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          handler: async ({ query, serviceContext, user }) =>
            listPageOf(
              (
                await listArticles({
                  context: serviceContext,
                  userId: user.id,
                  projectId: query.project_id,
                })
              ).sessions,
              (session) => session.groupId,
            ),
        })
        .view("sources", {
          auth: true,
          summary: "Read source articles by ID",
          middleware: access,
          querySchema: sourcesQuerySchema,
          responses: {
            200: { description: "Source articles", schema: sourceArticlesResponseSchema },
          },
          handler: async ({ query, serviceContext, user }) => ({
            articles: (
              await getSourceArticles({
                context: serviceContext,
                ids: (Array.isArray(query.ids) ? query.ids : [query.ids]).filter(Boolean),
                userId: user.id,
                projectId: query.project_id,
              })
            ).articles,
          }),
        })
        .collectionAction("extract", {
          auth: true,
          summary: "Extract article content from URLs",
          middleware: access,
          querySchema: projectScopeQuerySchema,
          bodySchema: contentExtractSchema,
          handler: async ({ body, serviceContext, user }) => {
            const extracted = await extractContent(
              {
                urls: body.urls,
                extract_depth: body.extract_depth || "basic",
                include_images: body.include_images || false,
              },
              { env: serviceContext.env, user },
            );

            if (extracted.status === "error") {
              throw new AssistantError("Failed to extract content", ErrorType.PARAMS_ERROR, 400);
            }

            return {
              content: extracted.data?.extracted.results.map((result) => result.raw_content) ?? [],
              failedUrls: extracted.data?.extracted.failed_results ?? [],
            };
          },
        })
        .action("analyse", {
          auth: true,
          summary: "Analyse an article in the session",
          middleware: access,
          paramSchema: articleParamsSchema,
          querySchema: projectScopeQuerySchema,
          bodySchema: articleAnalyzeSchema.omit({ itemId: true }),
          handler: ({ body, params, query, raw, serviceContext, user }) =>
            analyseArticle({
              completion_id: generateId(),
              context: serviceContext,
              args: { article: body.article, itemId: params.article_id },
              app_url: requestAppUrl(raw.req.url),
              user,
              projectId: query.project_id,
            }),
        })
        .action("summarise", {
          auth: true,
          summary: "Summarise an article in the session",
          middleware: access,
          paramSchema: articleParamsSchema,
          querySchema: projectScopeQuerySchema,
          bodySchema: articleSummariseSchema.omit({ itemId: true }),
          handler: ({ body, params, query, raw, serviceContext, user }) =>
            summariseArticle({
              completion_id: generateId(),
              context: serviceContext,
              args: { article: body.article, itemId: params.article_id },
              app_url: requestAppUrl(raw.req.url),
              user,
              projectId: query.project_id,
            }),
        })
        .action("report", {
          auth: true,
          summary: "Compare the session's articles in a report",
          middleware: access,
          paramSchema: articleParamsSchema,
          querySchema: projectScopeQuerySchema,
          handler: ({ params, query, raw, serviceContext, user }) =>
            generateArticlesReport({
              completion_id: generateId(),
              context: serviceContext,
              args: { itemId: params.article_id },
              app_url: requestAppUrl(raw.req.url),
              user,
              projectId: query.project_id,
            }),
        })
        .action("rerun", {
          auth: true,
          summary: "Prepare the session to run again",
          description: "Removes existing analyses and summaries so the session can be rerun.",
          middleware: access,
          paramSchema: articleParamsSchema,
          querySchema: projectScopeQuerySchema,
          handler: async ({ params, query, serviceContext, user }) => {
            await cleanupArticleSession(
              serviceContext,
              user.id,
              params.article_id,
              query.project_id,
            );

            return { prepared: true };
          },
        });

      articles.collection("reports", "report_id").read({
        auth: true,
        summary: "Get an article report",
        middleware: access,
        paramSchema: reportParamsSchema,
        querySchema: projectScopeQuerySchema,
        responses: { 200: { description: "The report", schema: articleDetailResponseSchema } },
        handler: async ({ params, query, serviceContext, user }) => ({
          article: (
            await getArticleDetails({
              context: serviceContext,
              id: params.report_id,
              userId: user.id,
              projectId: query.project_id,
            })
          ).article,
        }),
      });
    },
  );
}
