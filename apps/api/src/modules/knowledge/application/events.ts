import type { WebhookEventType } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";
import { dispatchWebhookEvent } from "~/modules/webhook-endpoints/application/dispatch";

export type KnowledgeChange = "filed" | "updated" | "removed" | "enriched";

const WEBHOOK_TYPES: Record<KnowledgeChange, WebhookEventType> = {
  filed: "knowledge.document.filed",
  updated: "knowledge.document.updated",
  removed: "knowledge.document.removed",
  enriched: "knowledge.document.enriched",
};

type ChangedSource = Pick<
  SourceRecord,
  "id" | "created_by_user_id" | "project_id" | "kind" | "title" | "external_uri" | "updated_at"
>;

export async function publishKnowledgeChange(
  context: Pick<ServiceContext, "env">,
  source: ChangedSource,
  change: KnowledgeChange,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const data = { sourceId: source.id, change, ...detail };

  await Promise.all([
    publishResourceEvent(
      context,
      source.project_id
        ? { kind: "project", projectId: source.project_id }
        : { kind: "personal", userId: source.created_by_user_id },
      "knowledge.changed",
      data,
    ),
    dispatchWebhookEvent(context.env, {
      userId: source.created_by_user_id,
      type: WEBHOOK_TYPES[change],
      idSeed: `knowledge:${change}:${source.id}:${source.updated_at ?? ""}:${JSON.stringify(detail)}`,
      data: {
        document: {
          id: source.id,
          kind: source.kind,
          title: source.title,
          project_id: source.project_id,
          url: source.external_uri,
        },
        ...detail,
      },
    }),
  ]);
}
