import {
  CONNECTOR_ACCOUNT_REFERENCE_KIND,
  listComposioConnectedAccounts,
  type ComposioConnectedAccount,
} from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";
import { z } from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ProviderConnectionRecord } from "~/modules/apps/infrastructure/ProviderConnectionRepository";

import { ensureRecipeConnectorAccountReference } from "./accounts";
import { findComposioAccountProvider } from "./connector-adapters";

const logger = getLogger({ prefix: "apps/connectors/composio-account-mirror" });

const ACCOUNT_SYNC_KIND = "recipe_connector_account_sync";
const ACCOUNT_SYNC_PROVIDER = "composio";
const ACCOUNT_REFRESH_MS = 5 * 60 * 1000;

const COMPOSIO_LIVE_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

const mirroredAccountSchema = z.object({
  composioUserId: z.string(),
  toolkitSlug: z.string(),
  authConfigId: z.string().optional(),
  status: z.string(),
  statusReason: z.string().optional(),
  isDisabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const syncStateSchema = z.object({
  syncedAt: z.string().optional(),
  liveUntil: z.string().optional(),
});

type SyncState = z.infer<typeof syncStateSchema>;

function readSyncState(connections: readonly ProviderConnectionRecord[]): SyncState {
  const marker = connections.find(
    (connection) =>
      connection.kind === ACCOUNT_SYNC_KIND && connection.provider === ACCOUNT_SYNC_PROVIDER,
  );
  const parsed = syncStateSchema.safeParse(marker ? parseJsonRecord(marker.metadata) : {});

  return parsed.success ? parsed.data : {};
}

function isReference(connection: ProviderConnectionRecord): boolean {
  return connection.kind === CONNECTOR_ACCOUNT_REFERENCE_KIND;
}

function toMirroredAccount(connection: ProviderConnectionRecord): ComposioConnectedAccount | null {
  const parsed = mirroredAccountSchema.safeParse(parseJsonRecord(connection.metadata));

  if (!parsed.success) {
    return null;
  }

  const { composioUserId, ...account } = parsed.data;

  return { ...account, id: connection.external_id, userId: composioUserId };
}

function isMirrorCurrent(
  connection: ProviderConnectionRecord | undefined,
  account: ComposioConnectedAccount,
): boolean {
  const mirrored = connection ? toMirroredAccount(connection) : null;

  return (
    mirrored !== null &&
    mirrored.status === account.status &&
    mirrored.isDisabled === account.isDisabled &&
    mirrored.authConfigId === account.authConfigId &&
    mirrored.updatedAt === account.updatedAt
  );
}

function isLive(state: SyncState, now: number): boolean {
  return state.liveUntil !== undefined && Date.parse(state.liveUntil) > now;
}

async function writeSyncState(context: ServiceContext, userId: number, state: SyncState) {
  await context.repositories.providerConnections.upsertConnection({
    userId,
    provider: ACCOUNT_SYNC_PROVIDER,
    kind: ACCOUNT_SYNC_KIND,
    encryptedData: {},
    metadata: state,
  });
}

export async function syncComposioAccountMirror(
  context: ServiceContext,
  userId: number,
  knownConnections?: readonly ProviderConnectionRecord[],
): Promise<ComposioConnectedAccount[]> {
  const [accounts, connections] = await Promise.all([
    listComposioConnectedAccounts({ env: context.env, userId }),
    knownConnections ?? context.repositories.providerConnections.listConnections(userId),
  ]);
  const references = new Map(
    connections
      .filter(isReference)
      .map((connection) => [`${connection.provider}:${connection.external_id}`, connection]),
  );
  const listed = new Set<string>();
  const writes: Promise<unknown>[] = [];

  for (const account of accounts) {
    const provider = findComposioAccountProvider(account);

    if (!provider) {
      continue;
    }

    const key = `${provider.id}:${account.id}`;

    listed.add(key);

    if (!isMirrorCurrent(references.get(key), account)) {
      writes.push(
        ensureRecipeConnectorAccountReference({
          context,
          userId,
          providerId: provider.id,
          account,
        }),
      );
    }
  }

  for (const [key, connection] of references) {
    const mirrored = toMirroredAccount(connection);

    if (!listed.has(key) && mirrored && mirrored.status !== "REVOKED") {
      writes.push(
        context.repositories.providerConnections.upsertConnection({
          userId,
          provider: connection.provider,
          kind: CONNECTOR_ACCOUNT_REFERENCE_KIND,
          externalId: connection.external_id,
          status: "revoked",
          encryptedData: {},
          metadata: { ...parseJsonRecord(connection.metadata), status: "REVOKED" },
        }),
      );
    }
  }

  await Promise.all(writes);

  const state = readSyncState(connections);
  const now = Date.now();

  await writeSyncState(context, userId, {
    syncedAt: new Date(now).toISOString(),
    ...(isLive(state, now) ? { liveUntil: state.liveUntil } : {}),
  });

  return accounts;
}

export async function listMirroredComposioAccounts(
  context: ServiceContext,
  userId: number,
  connections: readonly ProviderConnectionRecord[],
): Promise<ComposioConnectedAccount[]> {
  const state = readSyncState(connections);
  const now = Date.now();

  if (!state.syncedAt || isLive(state, now)) {
    return syncComposioAccountMirror(context, userId, connections);
  }

  if (now - Date.parse(state.syncedAt) > ACCOUNT_REFRESH_MS) {
    context.waitUntil(
      syncComposioAccountMirror(context, userId, connections).catch((error) => {
        logger.warn("Failed to refresh mirrored Composio accounts", { error, userId });
      }),
    );
  }

  return connections.flatMap((connection) => {
    const account = isReference(connection) ? toMirroredAccount(connection) : null;

    return account ? [account] : [];
  });
}

export async function beginLiveComposioAccountWindow(context: ServiceContext, userId: number) {
  const now = Date.now();

  await writeSyncState(context, userId, {
    ...readSyncState(await context.repositories.providerConnections.listConnections(userId)),
    liveUntil: new Date(now + COMPOSIO_LIVE_ACCOUNT_WINDOW_MS).toISOString(),
  });
}

export async function markComposioAccountExpired(context: ServiceContext, accountId: string) {
  await context.repositories.providerConnections.markExternalConnectionInvalid(
    CONNECTOR_ACCOUNT_REFERENCE_KIND,
    accountId,
    { status: "EXPIRED" },
  );
}
