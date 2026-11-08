import type z from "zod/v4";

import { requestModelReadsImages } from "~/modules/models/application/resolve";
import { renderHtmlPreview } from "~/modules/tools/application/preview/render";
import { summarisePreview } from "~/modules/tools/application/preview/summary";
import type { IFunctionResponse, MessageContent } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  preview_html as previewHtmlDescriptor,
  type previewHtmlInputSchema,
} from "./definitions/preview_html";

export const preview_html: ApiToolDefinition = {
  ...previewHtmlDescriptor,
  execute: async (args: z.infer<typeof previewHtmlInputSchema>, toolContext) => {
    const [previews, readsImages] = await Promise.all([
      renderHtmlPreview({
        env: toolContext.request.env,
        html: args.html,
        css: args.css,
        signal: toolContext.abortSignal,
      }),
      requestModelReadsImages(toolContext.request),
    ]);
    const screenshots = readsImages
      ? previews.flatMap((preview): MessageContent[] =>
          preview.status === "rendered"
            ? [
                { type: "text", text: `${preview.viewport} screenshot:` },
                { type: "image_url", image_url: { url: preview.screenshot, detail: "high" } },
              ]
            : [],
        )
      : [];
    const summary = summarisePreview(previews, screenshots.length > 0);

    return {
      status: previews.some((preview) => preview.status === "rendered") ? "success" : "error",
      name: previewHtmlDescriptor.name,
      content: screenshots.length > 0 ? [{ type: "text", text: summary }, ...screenshots] : summary,
      data: {
        previews: previews.map((preview) =>
          preview.status === "rendered"
            ? { viewport: preview.viewport, status: preview.status, report: preview.report }
            : preview,
        ),
      },
    } satisfies IFunctionResponse;
  },
};
