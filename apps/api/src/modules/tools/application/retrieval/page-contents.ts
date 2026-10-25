import { resolveHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { extractContent } from "./content-extract";

export async function readPageContents(
  context: ServiceContext,
  urls: readonly string[],
): Promise<Map<string, string>> {
  const requested = [...new Set(urls.flatMap((url) => resolveHttpUrl(url) ?? []))];

  if (requested.length === 0) {
    return new Map();
  }

  const extracted = await extractContent(
    { urls: requested },
    { env: context.env, user: context.requireUser(), context },
  );

  if (extracted.status === "error" || !extracted.data) {
    throw new AssistantError(
      extracted.error ?? "Those pages could not be read",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  return new Map(
    extracted.data.extracted.results.flatMap((page) => {
      const url = resolveHttpUrl(page.url);

      return url && page.raw_content?.trim() ? [[url, page.raw_content] as const] : [];
    }),
  );
}
