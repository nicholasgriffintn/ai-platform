import type { SourceContentSummary } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { digestDocument } from "~/modules/documents/application/digest";
import { readSourceSummary } from "~/modules/sources/domain/summary";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

export async function buildSourceSummary(
  context: ServiceContext,
  content: string,
  previous: SourceContentSummary | null,
): Promise<SourceContentSummary | null> {
  const text = content.trim();

  if (!text) {
    return null;
  }

  const contentHash = await sha256Hex(text);

  if (previous?.contentHash === contentHash) {
    return previous;
  }

  const { summary } = await digestDocument({
    env: context.env,
    user: context.requireUser(),
    markdown: text,
  });

  return { ...summary, contentHash, generatedAt: new Date().toISOString() };
}

export async function summariseStoredSource(
  context: ServiceContext,
  source: Pick<SourceRecord, "id" | "content" | "metadata">,
): Promise<void> {
  const metadata = parseJsonRecord(source.metadata);

  if (metadata.immutableSnapshot === true) {
    return;
  }

  const previous = readSourceSummary(metadata);
  const summary = await buildSourceSummary(context, source.content ?? "", previous);

  if (summary && summary !== previous) {
    await context.repositories.get(SourceRepository).setSourceSummary(source.id, summary);
  }
}
