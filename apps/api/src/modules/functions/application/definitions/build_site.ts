import { SITE_PROMPT_MAX_LENGTH } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const buildSiteInputSchema = z.object({
  brief: z
    .string()
    .trim()
    .min(1)
    .max(SITE_PROMPT_MAX_LENGTH)
    .describe(
      "What to build, in the user's words plus anything they said about audience, pages, tone or colours. For a change to an existing site, describe the change.",
    ),
  siteId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "The id of a site built earlier in this conversation when the user wants it changed.",
    ),
});

export const build_site: FunctionToolDescriptor = {
  name: "build_site",
  description:
    "Build a website, landing page, dashboard, form or UI component from a brief and show it inline as a working preview the user can open in Sites to refine, export or ship. Use it when someone asks for a site, a page, a screen or a mockup rather than a description of one. Pass siteId to change a site this conversation already built.",
  type: "normal",
  permissions: ["reasoning", "write"],
  inputSchema: buildSiteInputSchema,
};
