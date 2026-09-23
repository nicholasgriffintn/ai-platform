import { listSitePages, SITES_CAPABILITY_ID } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type z from "zod/v4";

import { runSiteGeneration } from "~/modules/sites/application/generate";
import { requireOptionalProjectCapabilityAccess } from "~/modules/workspaces/application/access";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  build_site as buildSiteDescriptor,
  type buildSiteInputSchema,
} from "./definitions/build_site";
import { resolveRequestProjectId } from "./request-context";

export const build_site: ApiToolDefinition = {
  ...buildSiteDescriptor,
  execute: async (args: z.infer<typeof buildSiteInputSchema>, toolContext) => {
    const request = toolContext.request;
    const user = request.user;
    const context = request.context;

    if (!context || !user?.id) {
      throw new AssistantError(
        "Building a site needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const projectId = resolveRequestProjectId(request) ?? undefined;

    await requireOptionalProjectCapabilityAccess(context, projectId, "app", SITES_CAPABILITY_ID);

    const { site, plan, issues } = await runSiteGeneration({
      context,
      user,
      request: { prompt: args.brief, projectId, siteId: args.siteId },
    });
    const pages = listSitePages(site.project);
    const summary = `${args.siteId ? "Updated" : "Built"} "${site.project.title}" (${plan.kind}, ${pages.length} ${pages.length === 1 ? "page" : "pages"}: ${pages.map(({ page }) => page.path).join(", ")}). It is shown inline and saved as site ${site.id}; pass siteId "${site.id}" to build_site to change it, or open it in Sites to refine, export or ship it.`;

    return {
      status: "success",
      name: buildSiteDescriptor.name,
      content: summary,
      data: {
        siteId: site.id,
        projectId: projectId ?? null,
        title: site.project.title,
        plan,
        project: site.project,
        issues,
        revision: site.revision,
      },
    } satisfies IFunctionResponse;
  },
};
