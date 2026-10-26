import { readSourceFraming } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";
import type z from "zod/v4";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { runKnowledgeEnricher } from "~/modules/knowledge/application/enrichment/run";
import { knowledgeSourceId } from "~/modules/knowledge/application/intake/commit";
import { fileKnowledgeSource } from "~/modules/knowledge/application/intake/file";
import { renderArticleFraming } from "~/modules/knowledge/domain/framing";
import { knowledgeArticleKey } from "~/modules/knowledge/domain/item";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  analyse_article as analyseArticleDescriptor,
  type analyseArticleInputSchema,
} from "./definitions/analyse_article";

export const analyse_article: ApiToolDefinition = {
  ...analyseArticleDescriptor,
  execute: async (args: z.infer<typeof analyseArticleInputSchema>, toolContext) => {
    const context = resolveServiceContext(toolContext.request);
    const projectId = resolveRequestProjectId(toolContext.request) ?? null;
    const pageKey = args.url ? knowledgeArticleKey(args.url) : null;
    const source = await fileKnowledgeSource(context, {
      ...(pageKey
        ? { id: await knowledgeSourceId({ userId: context.requireUser().id, projectId }, pageKey) }
        : {}),
      origin: pageKey ? "page" : "manual",
      kind: pageKey ? "url" : "text",
      title: sanitiseInput(args.title).slice(0, 200) || "Article",
      provider: pageKey ? "web" : null,
      content: sanitiseInput(args.article),
      externalUri: pageKey ? args.url : undefined,
      projectId,
    });
    const framing = readSourceFraming(
      parseJsonRecord((await runKnowledgeEnricher(context, source.id, "framing")).metadata),
    );

    if (!framing) {
      throw new AssistantError("The framing could not be read", ErrorType.PROVIDER_ERROR, 502);
    }

    return {
      status: "success",
      name: analyseArticleDescriptor.name,
      content: renderArticleFraming(framing),
      data: { sourceId: source.id, framing },
    } satisfies IFunctionResponse;
  },
};
