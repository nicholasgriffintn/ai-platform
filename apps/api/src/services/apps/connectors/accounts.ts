import type {
  RecipeConnectorAccount,
  RecipeConnectorAccountUpdateRequest,
  RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  type ComposioConnectedAccount,
  listComposioConnectedAccounts,
} from "~/lib/providers/capabilities/connectors/composio/client";
import type { ProviderConnectionRecord } from "~/repositories/ProviderConnectionRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { parseJsonRecord } from "~/utils/json";

import { CONNECTOR_ACCOUNT_REFERENCE_KIND } from "./connection-references";
import { getRecipeConnectorProviderConfig } from "./connector-adapters";

const ACCOUNT_ALIAS_KIND = "recipe_connector_account_alias";

export const ACCOUNT_SELECTION_KIND = "recipe_connector_account_selection";

function getMetadata(record: { metadata: string } | null | undefined): Record<string, unknown> {
  return record ? parseJsonRecord(record.metadata) : {};
}

export async function ensureRecipeConnectorAccountReference(params: {
  context: ServiceContext;
  userId: number;
  providerId: RecipeConnectorProvider;
  account: {
    id: string;
    authConfigId?: string;
    status: string;
    isDisabled: boolean;
  };
}): Promise<ProviderConnectionRecord> {
  return params.context.repositories.providerConnections.upsertConnection({
    userId: params.userId,
    provider: params.providerId,
    kind: CONNECTOR_ACCOUNT_REFERENCE_KIND,
    externalId: params.account.id,
    status:
      params.account.status === "ACTIVE" && !params.account.isDisabled ? "connected" : "invalid",
    encryptedData: {},
    metadata: {
      authConfigId: params.account.authConfigId,
      status: params.account.status,
      isDisabled: params.account.isDisabled,
    },
  });
}

export async function listRecipeConnectorAccounts(params: {
  context: ServiceContext;
  userId: number;
  providerId: RecipeConnectorProvider;
}): Promise<{ accounts: RecipeConnectorAccount[] }> {
  const provider = getRecipeConnectorProviderConfig(params.providerId);

  if (!provider || provider.auth.authType !== "composio") {
    throw new AssistantError(
      "Connector does not support connected accounts",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const [accounts, records] = await Promise.all([
    listComposioConnectedAccounts({
      env: params.context.env,
      userId: params.userId,
      toolkitSlugs: [provider.auth.toolkitSlug],
      authConfigIds: provider.auth.authConfigs.map((config) => config.id),
    }),
    params.context.repositories.providerConnections.listConnections(
      params.userId,
      params.providerId,
    ),
  ]);

  await Promise.all(
    accounts.map((account) =>
      ensureRecipeConnectorAccountReference({
        context: params.context,
        userId: params.userId,
        providerId: params.providerId,
        account,
      }),
    ),
  );
  const selection = records.find((record) => record.kind === ACCOUNT_SELECTION_KIND);
  const selectedAccountId = getMetadata(selection).accountId;
  const aliases = new Map(
    records
      .filter((record) => record.kind === ACCOUNT_ALIAS_KIND)
      .map((record) => [record.external_id, getMetadata(record).alias]),
  );

  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      providerId: params.providerId,
      alias:
        typeof aliases.get(account.id) === "string" ? (aliases.get(account.id) as string) : null,
      status: account.status,
      isDisabled: account.isDisabled,
      isSelected: selectedAccountId === account.id,
      authConfigId: account.authConfigId,
      connectedAt: account.createdAt,
      updatedAt: account.updatedAt,
    })),
  };
}

export async function updateRecipeConnectorAccount(params: {
  context: ServiceContext;
  userId: number;
  providerId: RecipeConnectorProvider;
  input: RecipeConnectorAccountUpdateRequest;
}): Promise<RecipeConnectorAccount> {
  const { accounts } = await listRecipeConnectorAccounts(params);
  const account = accounts.find((candidate) => candidate.id === params.input.accountId);

  if (!account) {
    throw new AssistantError("Connected account not found", ErrorType.NOT_FOUND, 404);
  }

  if (params.input.alias !== undefined) {
    if (params.input.alias === null) {
      await params.context.repositories.providerConnections.deleteConnection(
        params.userId,
        params.providerId,
        ACCOUNT_ALIAS_KIND,
        account.id,
      );
    } else {
      await params.context.repositories.providerConnections.upsertConnection({
        userId: params.userId,
        provider: params.providerId,
        kind: ACCOUNT_ALIAS_KIND,
        externalId: account.id,
        encryptedData: {},
        metadata: { alias: params.input.alias },
      });
    }
  }

  if (params.input.selected) {
    if (account.status !== "ACTIVE" || account.isDisabled) {
      throw new AssistantError(
        "Only an active account can be selected",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    await params.context.repositories.providerConnections.upsertConnection({
      userId: params.userId,
      provider: params.providerId,
      kind: ACCOUNT_SELECTION_KIND,
      encryptedData: {},
      metadata: { accountId: account.id },
    });
  }

  const refreshed = await listRecipeConnectorAccounts(params);

  return refreshed.accounts.find((candidate) => candidate.id === account.id) ?? account;
}

export async function getSelectedRecipeConnectorAccountId(params: {
  context: ServiceContext;
  userId: number;
  providerId: RecipeConnectorProvider;
}): Promise<string | undefined> {
  const selection = await params.context.repositories.providerConnections.getConnection(
    params.userId,
    params.providerId,
    ACCOUNT_SELECTION_KIND,
  );
  const value = getMetadata(selection).accountId;

  return typeof value === "string" ? value : undefined;
}

export function selectActiveRecipeConnectorAccount(params: {
  accounts: readonly ComposioConnectedAccount[];
  accountId?: string;
  requireExact: boolean;
}): ComposioConnectedAccount {
  const active = params.accounts.filter(
    (account) => account.status === "ACTIVE" && !account.isDisabled,
  );

  if (active.length === 0) {
    throw new AssistantError("Connector is not connected", ErrorType.AUTHORISATION_ERROR, 403);
  }

  const selected = active.find((account) => account.id === params.accountId);

  if (selected) {
    return selected;
  }

  if (params.requireExact) {
    throw new AssistantError(
      "The selected connector account is not connected",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return active.reduce((newest, account) =>
    account.createdAt > newest.createdAt ? account : newest,
  );
}
