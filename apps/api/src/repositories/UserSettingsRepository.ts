import { parsePetModelOverrides } from "@ngriffin_uk/polychat-schemas";
import { decodeBase64 } from "hono/utils/encode";

import { prepareUserSettingsUpdates } from "~/lib/database/user-settings";
import {
  createMessagingCredentialEnvelope,
  getMessagingCredentialConfigurationValues,
  parseMessagingCredentialEnvelope,
} from "~/lib/providers/capabilities/messaging/credentials";
import { isMessagingProviderId } from "~/lib/providers/capabilities/messaging/metadata";
import { getModels } from "~/lib/providers/models";
import type { IUserSettings } from "~/types";
import { bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { safeParseJson } from "../utils/json";
import { BaseRepository } from "./BaseRepository";

export class UserSettingsRepository extends BaseRepository {
  private static readonly CREDENTIALS_DELIMITER = "::@@::";
  private static readonly PROVIDER_API_KEY_LABEL = "provider-api-key";
  private static readonly PROVIDER_API_KEY_ENVELOPE_LABEL = "provider-api-key-envelope-key";

  private async getServerEncryptionKey() {
    if (!this.env.PRIVATE_KEY) {
      throw new AssistantError("Server key not configured", ErrorType.CONFIGURATION_ERROR);
    }

    return await crypto.subtle.importKey(
      "raw",
      decodeBase64(this.env.PRIVATE_KEY),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }

  private async encryptWithServerKey(data: JsonWebKey): Promise<{
    iv: string;
    data: string;
  }> {
    try {
      const key = await this.getServerEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(JSON.stringify(data)),
      );

      return {
        iv: bufferToBase64(iv),
        data: bufferToBase64(new Uint8Array(encryptedData)),
      };
    } catch {
      throw new AssistantError("Failed to encrypt data", ErrorType.UNKNOWN_ERROR);
    }
  }

  private async decryptWithServerKey(encryptedData: string): Promise<string> {
    try {
      const key = await this.getServerEncryptionKey();
      const parsedEncryptedData = safeParseJson(encryptedData);

      if (!parsedEncryptedData) {
        throw new AssistantError("Failed to parse encrypted data", ErrorType.INTERNAL_ERROR);
      }

      const { iv, data } = parsedEncryptedData;

      const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decodeBase64(iv) },
        key,
        decodeBase64(data),
      );

      return new TextDecoder().decode(decryptedData);
    } catch {
      throw new AssistantError("Failed to decrypt data", ErrorType.UNKNOWN_ERROR);
    }
  }

  private async encryptProviderApiKey(keyToEncrypt: string, publicKey: CryptoKey): Promise<string> {
    try {
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: "RSA-OAEP",
          label: new TextEncoder().encode(UserSettingsRepository.PROVIDER_API_KEY_LABEL),
        },
        publicKey,
        new TextEncoder().encode(keyToEncrypt),
      );

      return bufferToBase64(new Uint8Array(encryptedData));
    } catch {
      const dataKey = crypto.getRandomValues(new Uint8Array(32));
      const aesKey = await crypto.subtle.importKey("raw", dataKey, { name: "AES-GCM" }, false, [
        "encrypt",
      ]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        new TextEncoder().encode(keyToEncrypt),
      );
      const encryptedKey = await crypto.subtle.encrypt(
        {
          name: "RSA-OAEP",
          label: new TextEncoder().encode(UserSettingsRepository.PROVIDER_API_KEY_ENVELOPE_LABEL),
        },
        publicKey,
        dataKey,
      );

      return JSON.stringify({
        version: 1,
        algorithm: "RSA-OAEP-3072-SHA256+A256GCM",
        encryptedKey: bufferToBase64(new Uint8Array(encryptedKey)),
        iv: bufferToBase64(iv),
        data: bufferToBase64(new Uint8Array(encryptedData)),
      });
    }
  }

  private async decryptProviderApiKey(
    encryptedApiKey: string,
    privateKey: CryptoKey,
  ): Promise<string> {
    const envelope = safeParseJson(encryptedApiKey);

    if (
      envelope &&
      envelope.version === 1 &&
      typeof envelope.encryptedKey === "string" &&
      typeof envelope.iv === "string" &&
      typeof envelope.data === "string"
    ) {
      const dataKey = await crypto.subtle.decrypt(
        {
          name: "RSA-OAEP",
          label: new TextEncoder().encode(UserSettingsRepository.PROVIDER_API_KEY_ENVELOPE_LABEL),
        },
        privateKey,
        decodeBase64(envelope.encryptedKey),
      );
      const aesKey = await crypto.subtle.importKey("raw", dataKey, { name: "AES-GCM" }, false, [
        "decrypt",
      ]);
      const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decodeBase64(envelope.iv) },
        aesKey,
        decodeBase64(envelope.data),
      );

      return new TextDecoder().decode(decryptedData);
    }

    const decryptedApiKey = await crypto.subtle.decrypt(
      {
        name: "RSA-OAEP",
        label: new TextEncoder().encode(UserSettingsRepository.PROVIDER_API_KEY_LABEL),
      },
      privateKey,
      decodeBase64(encryptedApiKey),
    );

    return new TextDecoder().decode(decryptedApiKey);
  }

  public async createUserSettings(userId: number): Promise<void> {
    try {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 3072,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"],
      );

      const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
      const encryptedPrivateKey = await this.encryptWithServerKey(privateKey);
      const encryptedPrivateKeyString = JSON.stringify(encryptedPrivateKey);

      const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
      const publicKeyString = JSON.stringify(publicKey);

      const userSettingsId = generateId();

      const insert = this.buildInsertQuery("user_settings", {
        id: userSettingsId,
        user_id: userId,
        public_key: publicKeyString,
        private_key: encryptedPrivateKeyString,
      });

      if (!insert) {
        throw new AssistantError("Failed to create user settings", ErrorType.UNKNOWN_ERROR);
      }

      await this.executeRun(insert.query, insert.values);
    } catch {
      throw new AssistantError("Failed to create user settings", ErrorType.UNKNOWN_ERROR);
    }
  }

  public async updateUserSettings(
    userId: number,
    settings: Record<string, unknown>,
  ): Promise<void> {
    const updates = prepareUserSettingsUpdates(settings);

    const allowedFields = Object.keys(updates);

    const result = this.buildUpdateQuery("user_settings", updates, allowedFields, "user_id = ?", [
      userId,
    ]);

    if (!result) {
      return;
    }

    const queryWithTimestamp = result.query.replace(
      "updated_at = datetime('now')",
      "updated_at = CURRENT_TIMESTAMP",
    );

    await this.executeRun(queryWithTimestamp, result.values);
  }

  public async getUserSettings(userId: number): Promise<IUserSettings | null> {
    const columns = [
      "id",
      "nickname",
      "job_role",
      "traits",
      "preferences",
      "tracking_enabled",
      "guardrails_enabled",
      "guardrails_provider",
      "bedrock_guardrail_id",
      "bedrock_guardrail_version",
      "embedding_provider",
      "bedrock_knowledge_base_id",
      "bedrock_knowledge_base_custom_data_source_id",
      "s3vectors_bucket_name",
      "s3vectors_index_name",
      "s3vectors_region",
      "memories_save_enabled",
      "memories_chat_history_enabled",
      "temporary_chats_default",
      "memory_provider",
      "transcription_provider",
      "transcription_model",
      "speech_provider",
      "speech_model",
      "search_provider",
      "sandbox_model",
      "pet_source",
      "pet_id",
      "pet_travel_enabled",
      "pet_animation_enabled",
      "pet_model_overrides",
    ];
    const { query, values } = this.buildSelectQuery(
      "user_settings",
      { user_id: userId },
      { columns },
    );
    const result = await this.runQuery<any>(query, values, true);

    if (!result) {
      return null;
    }

    return {
      ...result,
      tracking_enabled: Boolean(result.tracking_enabled),
      guardrails_enabled: Boolean(result.guardrails_enabled),
      memories_save_enabled: Boolean(result.memories_save_enabled),
      memories_chat_history_enabled: Boolean(result.memories_chat_history_enabled),
      temporary_chats_default: Boolean(result.temporary_chats_default),
      pet_travel_enabled: Boolean(result.pet_travel_enabled),
      pet_animation_enabled: Boolean(result.pet_animation_enabled),
      pet_model_overrides: parsePetModelOverrides(
        typeof result.pet_model_overrides === "string"
          ? safeParseJson(result.pet_model_overrides)
          : result.pet_model_overrides,
      ),
    } as IUserSettings;
  }

  public async getUserEnabledModels(userId: number): Promise<Record<string, unknown>[]> {
    const { query, values } = this.buildSelectQuery(
      "model_settings",
      { user_id: userId },
      { columns: ["id", "model_id", "enabled"] },
    );
    const userModels = (await this.runQuery<{
      model_id: string;
      enabled: number;
    }>(query, values)) as { model_id: string; enabled: number }[];

    const userModelMap = new Map(userModels.map((model) => [model.model_id, model.enabled === 1]));

    const models = getModels();

    return Object.values(models).reduce(
      (enabledModels, model) => {
        const isModelEnabled = userModelMap.has(model.matchingModel)
          ? userModelMap.get(model.matchingModel)
          : model.isFeatured;

        if (isModelEnabled) {
          enabledModels.push({
            ...model,
            enabled: true,
          });
        }

        return enabledModels;
      },
      [] as Record<string, unknown>[],
    );
  }

  public async storeProviderApiKey(
    userId: number,
    providerId: string,
    apiKey: string,
    secretKey?: string,
    configuration?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.env.DB) {
      throw new AssistantError("Database is not configured", ErrorType.CONFIGURATION_ERROR);
    }

    if (!userId || !providerId || (!apiKey && !isMessagingProviderId(providerId))) {
      throw new AssistantError("Missing required parameters", ErrorType.PARAMS_ERROR);
    }

    try {
      const { query: providerQuery, values: providerValues } = this.buildSelectQuery(
        "provider_settings",
        { user_id: userId, provider_id: providerId },
        { columns: ["id", "api_key"] },
      );

      const existingProviderSettings = await this.runQuery<{ id: string; api_key: string | null }>(
        providerQuery,
        providerValues,
        true,
      );

      if (!existingProviderSettings) {
        throw new AssistantError("Provider settings not found", ErrorType.PARAMS_ERROR);
      }

      const { query: publicKeyQuery, values: publicKeyValues } = this.buildSelectQuery(
        "user_settings",
        { user_id: userId },
        { columns: ["public_key"] },
      );
      const result = await this.runQuery<{ public_key: string }>(
        publicKeyQuery,
        publicKeyValues,
        true,
      );

      if (!result?.public_key) {
        throw new AssistantError("User settings not found", ErrorType.NOT_FOUND);
      }

      const publicKeyJwk = safeParseJson(result.public_key);

      if (!publicKeyJwk) {
        throw new AssistantError("Failed to parse public key", ErrorType.INTERNAL_ERROR);
      }

      const publicKey = await crypto.subtle.importKey(
        "jwk",
        publicKeyJwk,
        {
          name: "RSA-OAEP",
          hash: "SHA-256",
        },
        false,
        ["encrypt"],
      );

      let keyToEncrypt = secretKey
        ? `${apiKey}${UserSettingsRepository.CREDENTIALS_DELIMITER}${secretKey}`
        : apiKey;

      if (isMessagingProviderId(providerId)) {
        const existingCredentials = existingProviderSettings.api_key
          ? parseMessagingCredentialEnvelope({
              providerId,
              value:
                (await this.decryptStoredProviderApiKey(userId, {
                  id: existingProviderSettings.id,
                  provider_id: providerId,
                })) ?? "",
            }).credentials
          : null;

        keyToEncrypt = JSON.stringify(
          createMessagingCredentialEnvelope({
            providerId,
            apiKey,
            secretKey,
            configuration,
            existingCredentials,
          }),
        );
      }

      const encryptedApiKey = await this.encryptProviderApiKey(keyToEncrypt, publicKey);

      const update = this.buildUpdateQuery(
        "provider_settings",
        {
          api_key: encryptedApiKey,
          enabled: 1,
        },
        ["api_key", "enabled"],
        "user_id = ? AND id = ?",
        [userId, existingProviderSettings.id],
      );

      if (!update) {
        return;
      }

      const queryWithTimestamp = update.query.replace(
        "updated_at = datetime('now')",
        "updated_at = CURRENT_TIMESTAMP",
      );

      await this.executeRun(queryWithTimestamp, update.values);
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError("Failed to store provider API key", ErrorType.UNKNOWN_ERROR);
    }
  }

  private async getProviderDecryptionKey(userId: number): Promise<CryptoKey> {
    if (!this.env.DB) {
      throw new AssistantError("Database is not configured", ErrorType.CONFIGURATION_ERROR);
    }

    if (!userId) {
      throw new AssistantError("Missing required parameters", ErrorType.PARAMS_ERROR);
    }

    const { query: settingsQuery, values: settingsValues } = this.buildSelectQuery(
      "user_settings",
      { user_id: userId },
      { columns: ["private_key"] },
    );
    const userSettings = await this.runQuery<{ private_key: string }>(
      settingsQuery,
      settingsValues,
      true,
    );

    if (!userSettings?.private_key) {
      throw new AssistantError("User settings not found", ErrorType.NOT_FOUND);
    }

    const decryptedPrivateKeyString = await this.decryptWithServerKey(userSettings.private_key);
    const privateKeyJwk = safeParseJson(decryptedPrivateKeyString);

    if (!privateKeyJwk) {
      throw new AssistantError("Failed to parse private key", ErrorType.INTERNAL_ERROR);
    }

    return crypto.subtle.importKey(
      "jwk",
      privateKeyJwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["decrypt"],
    );
  }

  private async decryptStoredProviderApiKey(
    userId: number,
    where: Record<string, unknown>,
  ): Promise<string | null> {
    const privateKey = await this.getProviderDecryptionKey(userId);

    const { query: providerQuery, values: providerValues } = this.buildSelectQuery(
      "provider_settings",
      { user_id: userId, ...where },
      { columns: ["api_key"] },
    );
    const result = await this.runQuery<{ api_key: string }>(providerQuery, providerValues, true);

    if (!result?.api_key) {
      return null;
    }

    return this.decryptProviderApiKey(result.api_key, privateKey);
  }

  public async getProviderApiKey(userId: number, providerId: string): Promise<string | null> {
    if (!this.env.DB) {
      throw new AssistantError("Database is not configured", ErrorType.CONFIGURATION_ERROR);
    }

    if (!userId || !providerId) {
      throw new AssistantError("Missing required parameters", ErrorType.PARAMS_ERROR);
    }

    try {
      return await this.decryptStoredProviderApiKey(userId, { provider_id: providerId });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError("Failed to retrieve provider API key", ErrorType.UNKNOWN_ERROR);
    }
  }

  public async getProviderApiKeyForSettings(params: {
    userId: number;
    providerId: string;
    providerSettingsId: string;
  }): Promise<string | null> {
    if (!this.env.DB) {
      throw new AssistantError("Database is not configured", ErrorType.CONFIGURATION_ERROR);
    }

    if (!params.userId || !params.providerId || !params.providerSettingsId) {
      throw new AssistantError("Missing required parameters", ErrorType.PARAMS_ERROR);
    }

    try {
      return await this.decryptStoredProviderApiKey(params.userId, {
        id: params.providerSettingsId,
        provider_id: params.providerId,
      });
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError("Failed to retrieve provider API key", ErrorType.UNKNOWN_ERROR);
    }
  }

  public async deleteProviderApiKey(userId: number, providerId: string): Promise<void> {
    if (!this.env.DB) {
      throw new AssistantError("Database is not configured", ErrorType.CONFIGURATION_ERROR);
    }

    if (!userId || !providerId) {
      throw new AssistantError("Missing required parameters", ErrorType.PARAMS_ERROR);
    }

    const update = this.buildUpdateQuery(
      "provider_settings",
      {
        api_key: null,
        enabled: 0,
      },
      ["api_key", "enabled"],
      "user_id = ? AND provider_id = ?",
      [userId, providerId],
    );

    if (!update) {
      return;
    }

    const queryWithTimestamp = update.query.replace(
      "updated_at = datetime('now')",
      "updated_at = CURRENT_TIMESTAMP",
    );

    await this.executeRun(queryWithTimestamp, update.values);
  }

  public async createUserProviderSettings(
    userId: number,
    configurableProviderIds: readonly string[],
  ): Promise<void> {
    const providers = configurableProviderIds;
    const alwaysEnabledProviders = this.env.ALWAYS_ENABLED_PROVIDERS || "";
    const defaultProviders = alwaysEnabledProviders?.split(",") || [];

    const existingQuery = this.buildSelectQuery(
      "provider_settings",
      { user_id: userId },
      { columns: ["provider_id"] },
    );
    const existingRows = await this.runQuery<{ provider_id: string }>(
      existingQuery.query,
      existingQuery.values,
    );
    const existingProviders = new Set(
      (Array.isArray(existingRows) ? existingRows : []).map((row) => row.provider_id),
    );

    const inserts = providers
      .filter((provider) => !existingProviders.has(provider))
      .map((provider) =>
        this.buildInsertQuery("provider_settings", {
          id: generateId(),
          user_id: userId,
          provider_id: provider,
          enabled: defaultProviders.includes(provider) ? 1 : 0,
        }),
      )
      .filter((insert): insert is { query: string; values: unknown[] } => Boolean(insert));

    if (inserts.length === 0) {
      return;
    }

    const database = this.env.DB;

    if (!database) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    await database.batch(
      inserts.map((insert) => database.prepare(insert.query).bind(...insert.values)),
    );
  }

  public async getUserProviderSettings(userId: number): Promise<Record<string, unknown>[]> {
    const { query, values } = this.buildSelectQuery(
      "provider_settings",
      { user_id: userId },
      { columns: ["id", "provider_id", "enabled", "api_key"] },
    );

    const result = await this.runQuery<{
      id: string;
      provider_id: string;
      enabled: number;
      api_key: string | null;
    }>(query, values);

    return Promise.all(
      result.map(async (provider) => {
        let configurationValues: Record<string, string> | undefined;

        if (provider.api_key && isMessagingProviderId(provider.provider_id)) {
          const decryptedValue = await this.decryptStoredProviderApiKey(userId, {
            id: provider.id,
            provider_id: provider.provider_id,
          });

          if (decryptedValue) {
            configurationValues = getMessagingCredentialConfigurationValues(
              parseMessagingCredentialEnvelope({
                providerId: provider.provider_id,
                value: decryptedValue,
              }).credentials,
            );
          }
        }

        return {
          id: provider.id,
          provider_id: provider.provider_id,
          configurationValues,
          webhookUrl:
            isMessagingProviderId(provider.provider_id) && this.env.API_BASE_URL
              ? `${this.env.API_BASE_URL.replace(/\/$/, "")}/webhooks/sms/${
                  provider.provider_id
                }/${provider.id}`
              : undefined,
          enabled: provider.enabled === 1,
          hasApiKey: Boolean(provider.api_key),
        };
      }),
    );
  }

  public async getProviderSyncStatus(
    userId: number,
    configurableProviderIds: readonly string[],
  ): Promise<{
    required: boolean;
    missingProviderIds: string[];
  }> {
    const { query, values } = this.buildSelectQuery(
      "provider_settings",
      { user_id: userId },
      { columns: ["provider_id"] },
    );
    const storedProviders = await this.runQuery<{ provider_id: string }>(query, values);
    const storedProviderIds = new Set(storedProviders.map(({ provider_id }) => provider_id));
    const missingProviderIds = configurableProviderIds.filter(
      (providerId) => !storedProviderIds.has(providerId),
    );

    return {
      required: missingProviderIds.length > 0,
      missingProviderIds,
    };
  }

  public async getProviderSettingsById(params: {
    providerSettingsId: string;
    providerId: string;
  }): Promise<{ id: string; user_id: number; provider_id: string; enabled: number } | null> {
    const { query, values } = this.buildSelectQuery(
      "provider_settings",
      { id: params.providerSettingsId, provider_id: params.providerId },
      { columns: ["id", "user_id", "provider_id", "enabled"] },
    );

    return this.runQuery<{
      id: string;
      user_id: number;
      provider_id: string;
      enabled: number;
    }>(query, values, true);
  }

  public async hasProviderApiKey(userId: number, providerId: string): Promise<boolean> {
    if (!userId || !providerId.trim()) {
      return false;
    }

    const { query, values } = this.buildSelectQuery(
      "provider_settings",
      { user_id: userId, provider_id: providerId },
      { columns: ["api_key"] },
    );

    const result = await this.runQuery<{ api_key: string | null }>(query, values, true);

    return Boolean(result?.api_key);
  }
}
