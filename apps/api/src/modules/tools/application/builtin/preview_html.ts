import type z from "zod/v4";

import { requestModelReadsImages } from "~/modules/models/application/resolve";
import { renderHtmlPreview } from "~/modules/tools/application/preview/render";
import {
  selectPreviewScreenshots,
  storePreviewScreenshots,
} from "~/modules/tools/application/preview/screenshots";
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
      ? await storePreviewScreenshots(toolContext.request, selectPreviewScreenshots(previews))
      : null;
    const images = (screenshots ?? []).flatMap((screenshot): MessageContent[] =>
      screenshot.status === "attached"
        ? [
            { type: "text", text: `${screenshot.viewport} screenshot:` },
            { type: "image_url", image_url: { url: screenshot.url, detail: "high" } },
          ]
        : [],
    );
    const summary = summarisePreview(previews, screenshots);

    return {
      status: previews.some((preview) => preview.status === "rendered") ? "success" : "error",
      name: previewHtmlDescriptor.name,
      content: images.length > 0 ? [{ type: "text", text: summary }, ...images] : summary,
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
