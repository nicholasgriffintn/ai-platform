import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { misconfigured, modelProviderErrorFromStatus } from "../errors.js";
import { type Fetcher, readUpstreamError } from "../http.js";
import type { ProviderCredentials } from "../types.js";

const MANAGEMENT_SCOPE = "https://management.azure.com/.default";

export interface AzureSettings {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
  resourceGroup: string;
  workspace: string;
  region: string;
}

export function readAzureSettings(credentials: ProviderCredentials): AzureSettings {
  const { tenantId, clientId, subscriptionId, resourceGroup, workspace, region } =
    credentials.config;
  const clientSecret = credentials.secrets.clientSecret;

  if (!tenantId || !clientId || !clientSecret || !subscriptionId || !resourceGroup || !workspace) {
    throw misconfigured(
      "The Azure connection needs a tenant, client, secret, subscription, resource group and workspace",
    );
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    subscriptionId,
    resourceGroup,
    workspace,
    region: region || "eastus",
  };
}

export class AzureTokenSource {
  private cached: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly settings: AzureSettings,
    private readonly fetcher: Fetcher,
  ) {}

  async token(scope = MANAGEMENT_SCOPE): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    if (scope === MANAGEMENT_SCOPE && this.cached && this.cached.expiresAt - 60 > now) {
      return this.cached.token;
    }

    const response = await this.fetcher(
      `https://login.microsoftonline.com/${encodeURIComponent(this.settings.tenantId)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.settings.clientId,
          client_secret: this.settings.clientSecret,
          scope,
        }),
      },
    );

    if (!response.ok) {
      throw modelProviderErrorFromStatus(
        response.status,
        "Signing in to Azure",
        await readUpstreamError(response),
      );
    }

    const body: unknown = await response.json();

    if (!isRecord(body) || typeof body.access_token !== "string") {
      throw misconfigured("Azure did not return an access token");
    }

    if (scope === MANAGEMENT_SCOPE) {
      this.cached = {
        token: body.access_token,
        expiresAt: now + (typeof body.expires_in === "number" ? body.expires_in : 3600),
      };
    }

    return body.access_token;
  }
}
