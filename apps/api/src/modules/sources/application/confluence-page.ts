import { isHttpUrl, isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { htmlToPlainText } from "@ngriffin_uk/polychat-utility-server/html-text";
import z from "zod/v4";

const pageSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1).max(200),
  status: z.string(),
  version: z.object({ number: z.number().int().positive() }).optional(),
  body: z.object({ storage: z.object({ value: z.string().max(500_000) }).optional() }).optional(),
  _links: z.object({ webui: z.string().optional(), base: z.string().optional() }).optional(),
});

export function normaliseConfluencePage(result: unknown, pageId: string) {
  const data = isRecord(result) && "data" in result ? result.data : result;
  const page = pageSchema.parse(data);

  if (page.id !== pageId) {
    throw new AssistantError("Confluence returned a different page", ErrorType.PROVIDER_ERROR, 502);
  }

  const archived = ["archived", "trashed", "deleted"].includes(page.status);

  if (!archived && (page.status !== "current" || !page.body?.storage || !page.version)) {
    throw new AssistantError(
      "Request a published page with its storage body and version",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  let externalUri: string | null = null;

  if (page._links?.webui) {
    try {
      const url = new URL(page._links.webui, page._links.base);

      if (isHttpUrl(url.href)) {
        externalUri = url.href;
      }
    } catch {}
  }

  return {
    title: page.title,
    status: archived ? ("archived" as const) : ("available" as const),
    content: archived ? "" : htmlToPlainText(page.body?.storage?.value ?? ""),
    externalUri,
    upstreamRevision: page.version?.number ?? null,
  };
}
