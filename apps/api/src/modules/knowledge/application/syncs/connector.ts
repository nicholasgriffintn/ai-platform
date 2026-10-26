import {
  buildDescriptorParameters,
  normaliseConnectorKnowledge,
  readConnectorKnowledgeBody,
  readConnectorKnowledgePage,
  type ConnectorKnowledgeItem,
} from "@ngriffin_uk/polychat-ai-integrations";
import type {
  KnowledgeConnectorDescriptor,
  KnowledgeSyncCheckpoint,
  KnowledgeSyncDescriptorResource,
  KnowledgeSyncMappedResource,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  fetchFollowingSafeRedirects,
  parsePublicHttpUrl,
  readResponseTextWithinLimit,
} from "@ngriffin_uk/polychat-utility-server/http";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { executeRecipeConnectorOperation } from "~/modules/connectors/application/operations";
import { commitKnowledgeDocument } from "~/modules/knowledge/application/intake/commit";
import {
  isConnectorKnowledgeSync,
  parseKnowledgeSyncCheckpoint,
  parseKnowledgeSyncResources,
  requireKnowledgeDescriptor,
} from "~/modules/knowledge/application/syncs/record";
import {
  publishKnowledgeSyncChanged,
  requireKnowledgeSyncAuthority,
  requireKnowledgeSyncTarget,
} from "~/modules/knowledge/application/syncs/syncs";
import { readKnowledgeUpstream } from "~/modules/knowledge/domain/envelope";
import type { KnowledgeTarget } from "~/modules/knowledge/domain/item";
import { KnowledgeDocumentRepository } from "~/modules/knowledge/infrastructure/KnowledgeDocumentRepository";
import {
  KnowledgeSyncRepository,
  type ConnectorKnowledgeSyncRecord,
} from "~/modules/knowledge/infrastructure/KnowledgeSyncRepository";

const RESOURCES_PER_RUN = 10;
const PAGES_PER_RUN = 5;
const DOWNLOAD_BYTES = 10_000_000;

type Authority = Awaited<ReturnType<typeof requireKnowledgeSyncAuthority>>;

async function syncedSourceId(syncId: string, resourceId: string, externalId?: string) {
  return `source_sync_${await sha256Hex(
    externalId === undefined ? `${syncId}:${resourceId}` : `${syncId}:${resourceId}:${externalId}`,
  )}`;
}

async function executeRead(
  context: ServiceContext,
  sync: ConnectorKnowledgeSyncRecord,
  authority: Authority,
  operation: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  return executeRecipeConnectorOperation({
    context,
    userId: sync.user_id,
    request: {
      provider: authority.provider,
      operation,
      connectedAccountId: authority.connection.external_id,
      params,
    },
    scope: {
      completionId: context.connectorRunId,
      conversationId: null,
      projectId: sync.project_id,
      recipeId: sync.recipe_id,
    },
  });
}

async function syncMappedResource(
  context: ServiceContext,
  sync: ConnectorKnowledgeSyncRecord,
  token: string,
  resource: KnowledgeSyncMappedResource,
  resourceCount: number,
  target: KnowledgeTarget,
): Promise<boolean> {
  const authority = await requireKnowledgeSyncAuthority(context, sync, [resource]);
  const sourceId = await syncedSourceId(sync.id, resource.resourceId);
  const repository = context.repositories.get(KnowledgeSyncRepository);
  let result: unknown;

  try {
    result = await executeRead(
      context,
      sync,
      authority,
      resource.operation,
      resource.readParameters,
    );
  } catch (error) {
    if (error instanceof AssistantError && [403, 404].includes(error.statusCode)) {
      await requireKnowledgeSyncAuthority(context, sync, [resource]);
      await repository.markUnavailable(sync, token, sourceId);
    }

    throw error;
  }

  const document = normaliseConnectorKnowledge(result, resource);

  await requireKnowledgeSyncAuthority(context, sync, [resource]);

  if (!(await repository.holdsWriteLease(sync, token))) {
    return false;
  }

  await commitKnowledgeDocument(context, target, {
    id: sourceId,
    origin: "connector",
    kind: "connector",
    title: document.title,
    provider: authority.provider,
    externalUri: document.externalUri,
    content: document.content,
    status: document.status,
    connectionId: sync.connection_id,
    upstream: {
      provider: authority.provider,
      externalId: resource.resourceId,
      ...(document.upstreamRevision === null ? {} : { revision: document.upstreamRevision }),
      syncedAt: new Date().toISOString(),
    },
    metadata: { syncId: sync.id, syncResource: resource.resourceId },
  });

  return repository.advanceResource(sync, token, resourceCount, parseKnowledgeSyncCheckpoint(sync));
}

async function downloadText(url: string): Promise<string> {
  const response = await fetchFollowingSafeRedirects(parsePublicHttpUrl(url), {});

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `The document download answered with ${response.status}`,
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  return readResponseTextWithinLimit(response, DOWNLOAD_BYTES);
}

async function readItemBody(
  context: ServiceContext,
  sync: ConnectorKnowledgeSyncRecord,
  authority: Authority,
  descriptor: KnowledgeConnectorDescriptor,
  item: ConnectorKnowledgeItem,
): Promise<string> {
  if (item.content !== null || !descriptor.read || item.status === "archived") {
    return item.content ?? "";
  }

  const result = await executeRead(context, sync, authority, descriptor.read.operation, {
    ...descriptor.read.parameters,
    [descriptor.read.idParameter]: item.externalId,
  });
  const body = readConnectorKnowledgeBody(result, descriptor.read.content);

  return "url" in body ? downloadText(body.url) : (body.text ?? "");
}

function updatedSinceParameter(
  descriptor: KnowledgeConnectorDescriptor,
  since: string | undefined,
): Record<string, unknown> {
  const window = descriptor.list.updatedSince;

  if (!window || !since) {
    return {};
  }

  return {
    [window.request]:
      window.format === "iso" ? since : String(Math.floor(new Date(since).getTime() / 1000)),
  };
}

function pageParameter(
  descriptor: KnowledgeConnectorDescriptor,
  checkpoint: KnowledgeSyncCheckpoint,
): Record<string, unknown> {
  const pagination = descriptor.list.pagination;

  if (!pagination) {
    return {};
  }

  if (pagination.kind === "page") {
    return { [pagination.request]: checkpoint.page ?? pagination.start };
  }

  return checkpoint.cursor ? { [pagination.request]: checkpoint.cursor } : {};
}

async function fileItem(
  context: ServiceContext,
  sync: ConnectorKnowledgeSyncRecord,
  authority: Authority,
  descriptor: KnowledgeConnectorDescriptor,
  resource: KnowledgeSyncDescriptorResource,
  target: KnowledgeTarget,
  item: ConnectorKnowledgeItem,
  pass: number,
): Promise<"filed" | "unchanged"> {
  const sourceId = await syncedSourceId(sync.id, resource.resourceId, item.externalId);
  const existing = await context.repositories.get(KnowledgeDocumentRepository).find(sourceId);
  const upstream = existing ? readKnowledgeUpstream(parseJsonRecord(existing.metadata)) : null;

  if (
    existing &&
    item.revision !== null &&
    upstream?.revision === item.revision &&
    existing.status === item.status
  ) {
    return "unchanged";
  }

  const content = await readItemBody(context, sync, authority, descriptor, item);

  await commitKnowledgeDocument(context, target, {
    id: sourceId,
    origin: "connector",
    kind: "connector",
    title: item.title ?? content.split("\n", 1)[0]?.trim().slice(0, 200) ?? item.externalId,
    provider: authority.provider,
    externalUri: item.externalUri,
    content,
    status: item.status,
    connectionId: sync.connection_id,
    upstream: {
      provider: authority.provider,
      externalId: item.externalId,
      ...(item.revision === null ? {} : { revision: item.revision }),
      ...(item.externalUri ? { url: item.externalUri } : {}),
      ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}),
      syncedAt: new Date().toISOString(),
    },
    metadata: { syncId: sync.id, syncResource: resource.resourceId, syncPass: pass },
  });

  return "filed";
}

async function syncDescriptorResource(
  context: ServiceContext,
  sync: ConnectorKnowledgeSyncRecord,
  token: string,
  resource: KnowledgeSyncDescriptorResource,
  resourceCount: number,
  target: KnowledgeTarget,
): Promise<boolean> {
  const repository = context.repositories.get(KnowledgeSyncRepository);
  let checkpoint = parseKnowledgeSyncCheckpoint(sync);
  const startedAt = checkpoint.startedAt ?? new Date().toISOString();
  const pass = sync.generation;

  for (let pageCount = 0; pageCount < PAGES_PER_RUN; pageCount++) {
    const authority = await requireKnowledgeSyncAuthority(context, sync, [resource]);
    const descriptor = requireKnowledgeDescriptor(resource, authority.provider);
    const since = checkpoint.since[resource.resourceId];
    const result = await executeRead(context, sync, authority, descriptor.list.operation, {
      ...buildDescriptorParameters(descriptor.list.parameters, resource.descriptor.parameters),
      ...updatedSinceParameter(descriptor, since),
      ...pageParameter(descriptor, checkpoint),
    });
    const page = readConnectorKnowledgePage(result, descriptor, checkpoint.page);
    const unchanged: string[] = [];

    if (!(await repository.holdsWriteLease(sync, token))) {
      return false;
    }

    for (const item of page.items) {
      if (
        (await fileItem(context, sync, authority, descriptor, resource, target, item, pass)) ===
        "unchanged"
      ) {
        unchanged.push(await syncedSourceId(sync.id, resource.resourceId, item.externalId));
      }
    }

    await repository.markItemsSeen(sync, pass, unchanged);
    await publishKnowledgeSyncChanged(context, sync);

    if (page.next) {
      checkpoint = {
        ...checkpoint,
        startedAt,
        cursor: "cursor" in page.next ? page.next.cursor : null,
        page: "page" in page.next ? page.next.page : null,
      };

      if (!(await repository.saveCheckpoint(sync, token, checkpoint))) {
        return false;
      }

      continue;
    }

    if (!descriptor.list.updatedSince || !since) {
      await repository.archiveUnseen(sync, resource.resourceId, pass);
    }

    return repository.advanceResource(sync, token, resourceCount, {
      ...checkpoint,
      cursor: null,
      page: null,
      startedAt: null,
      since: { ...checkpoint.since, [resource.resourceId]: startedAt },
    });
  }

  return false;
}

export async function syncConnectorResources(
  context: ServiceContext,
  initial: ConnectorKnowledgeSyncRecord,
  token: string,
): Promise<void> {
  const resources = parseKnowledgeSyncResources(initial);
  const repository = context.repositories.get(KnowledgeSyncRepository);
  let sync = initial;

  for (let count = 0; count < RESOURCES_PER_RUN; count++) {
    const resource = resources[sync.cursor];

    if (!resource) {
      throw new AssistantError(
        "Knowledge sync checkpoint is invalid",
        ErrorType.CONFIGURATION_ERROR,
        409,
      );
    }

    const target = await requireKnowledgeSyncTarget(context, sync);
    const advanced =
      "descriptor" in resource
        ? await syncDescriptorResource(context, sync, token, resource, resources.length, target)
        : await syncMappedResource(context, sync, token, resource, resources.length, target);

    await publishKnowledgeSyncChanged(context, sync);

    if (!advanced) {
      return;
    }

    const latest = await repository.get(sync.id);

    if (
      !latest ||
      latest.generation !== initial.generation ||
      !isConnectorKnowledgeSync(latest) ||
      latest.cursor === 0
    ) {
      return;
    }

    sync = latest;
  }
}
