import { isRecord, normaliseLowercaseList } from "@ngriffin_uk/polychat-utility-core";

import { normalizeGitHubPrivateKey } from "~/infrastructure/github/app-jwt";

export interface GitHubAppConnection {
  credentialSource: "user" | "deployment";
  appId: string;
  privateKey: string;
  installationId: number;
  webhookSecret?: string;
}

export interface GitHubConnectionRecordData {
  credential_source: "user" | "deployment";
  app_id: string;
  private_key: string;
  installation_id: number;
  webhook_secret?: string;
  repositories?: string[];
}

export function parseGitHubConnectionData(params: { data: unknown; recordItemId?: string }): {
  data: GitHubConnectionRecordData;
  connection: GitHubAppConnection;
} | null {
  const { data: rawData, recordItemId } = params;

  if (!isRecord(rawData)) {
    return null;
  }

  const root = rawData;

  if (typeof root.app_id !== "string" || !root.app_id.trim()) {
    return null;
  }

  if (typeof root.private_key !== "string" || !root.private_key.trim()) {
    return null;
  }

  if (typeof root.installation_id !== "number" || !Number.isFinite(root.installation_id)) {
    return null;
  }

  if (root.webhook_secret !== undefined && typeof root.webhook_secret !== "string") {
    return null;
  }

  const credentialSource =
    root.credential_source === "user"
      ? "user"
      : root.credential_source === "deployment"
        ? "deployment"
        : undefined;

  if (credentialSource === undefined) {
    return null;
  }

  if (root.repositories !== undefined && !Array.isArray(root.repositories)) {
    return null;
  }

  const normalizedAppId = root.app_id.trim();
  const normalizedPrivateKey = normalizeGitHubPrivateKey(root.private_key);
  const normalizedWebhookSecret =
    typeof root.webhook_secret === "string" && root.webhook_secret.trim()
      ? root.webhook_secret.trim()
      : undefined;
  const normalizedRepositories = Array.isArray(root.repositories)
    ? normaliseLowercaseList(
        root.repositories.filter((item): item is string => typeof item === "string"),
      )
    : undefined;

  const installationId = root.installation_id;

  if (recordItemId) {
    const itemInstallationId = Number.parseInt(recordItemId, 10);

    if (Number.isFinite(itemInstallationId) && itemInstallationId !== installationId) {
      return null;
    }
  }

  const recordData: GitHubConnectionRecordData = {
    credential_source: credentialSource,
    app_id: normalizedAppId,
    private_key: normalizedPrivateKey,
    installation_id: installationId,
    webhook_secret: normalizedWebhookSecret,
    repositories: normalizedRepositories,
  };

  return {
    data: recordData,
    connection: {
      credentialSource: recordData.credential_source,
      appId: recordData.app_id,
      privateKey: recordData.private_key,
      installationId,
      webhookSecret: recordData.webhook_secret,
    },
  };
}

export function recordAllowsRepo(data: GitHubConnectionRecordData, repo: string): boolean {
  const targetRepo = repo.trim().toLowerCase();

  if (!targetRepo) {
    return false;
  }

  if (data.repositories === undefined) {
    return true;
  }

  return data.repositories.includes(targetRepo);
}
