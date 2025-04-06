import { decodeBase64 } from "hono/utils/encode";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getModels } from "../lib/models";
import { AIProviderFactory } from "../providers/factory";
import type { IUserSettings } from "../types";
import { bufferToBase64 } from "../utils/base64";
import { BaseRepository } from "./BaseRepository";

export class UserSettingsRepository extends BaseRepository {
  private static readonly CREDENTIALS_DELIMITER = "::@@::";

  private async getServerEncryptionKey() {
    if (!this.env.PRIVATE_KEY) {
      throw new AssistantError(
        "Server key not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
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
    } catch (error) {
      throw new AssistantError(
        "Failed to encrypt data",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  }

  private async decryptWithServerKey(encryptedData: string): Promise<string> {
    try {
      const key = await this.getServerEncryptionKey();
      const { iv, data } = JSON.parse(encryptedData);

      const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decodeBase64(iv) },
        key,
        decodeBase64(data),
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      throw new AssistantError(
        "Failed to decrypt data",
        ErrorType.UNKNOWN_ERROR,
      );
    }
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

      const privateKey = await crypto.subtle.exportKey(
        "jwk",
        keyPair.privateKey,
      );
      const encryptedPrivateKey = await this.encryptWithServerKey(privateKey);
      const encryptedPrivateKeyString = JSON.stringify(encryptedPrivateKey);

      const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
      const publicKeyString = JSON.stringify(publicKey);

      const userSettingsId = crypto.randomUUID();

      await this.executeRun(
        `INSERT INTO user_settings (id, user_id, public_key, private_key)
         VALUES (?, ?, ?, ?)`,
        [userSettingsId, userId, publicKeyString, encryptedPrivateKeyString],
      );
    } catch (error) {
      throw new AssistantError(
        "Failed to create user settings",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  }

  public async updateUserSettings(
    userId: number,
    settings: Record<string, unknown>,
  ): Promise<void> {
    await this.executeRun(
      `UPDATE user_settings
       SET 
         nickname = ?,
         job_role = ?,
         traits = ?,
         preferences = ?,
         tracking_enabled = ?,
         guardrails_enabled = ?,
         guardrails_provider = ?,
         bedrock_guardrail_id = ?,
         bedrock_guardrail_version = ?,
         updated_at = datetime('now')
       WHERE user_id = ?`,
      [
        settings.nickname,
        settings.job_role,
        settings.traits,
        settings.preferences,
        settings.tracking_enabled !== undefined
          ? settings.tracking_enabled
            ? 1
            : 0
          : null,
        settings.guardrails_enabled !== undefined
          ? settings.guardrails_enabled
            ? 1
            : 0
          : null,
        settings.guardrails_provider,
        settings.bedrock_guardrail_id,
        settings.bedrock_guardrail_version,
        userId,
      ],
    );
  }

  public async getUserSettings(userId: number): Promise<IUserSettings | null> {
    const result = this.runQuery<IUserSettings>(
      "SELECT id, nickname, job_role, traits, preferences, tracking_enabled, guardrails_enabled, guardrails_provider, bedrock_guardrail_id, bedrock_guardrail_version FROM user_settings WHERE user_id = ?",
      [userId],
      true,
    );
    return result;
  }

  public async getUserEnabledModels(
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    const userModels = (await this.runQuery<{
      model_id: string;
      enabled: number;
    }>("SELECT id, model_id, enabled FROM model_settings WHERE user_id = ?", [
      userId,
    ])) as { model_id: string; enabled: number }[];

    const userModelMap = new Map(
      userModels.map((model) => [model.model_id, model.enabled === 1]),
    );

    const models = await getModels();

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
  ): Promise<void> {
    if (!this.env.DB) {
      throw new AssistantError(
        "Database is not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    if (!userId || !providerId || !apiKey) {
      throw new AssistantError(
        "Missing required parameters",
        ErrorType.PARAMS_ERROR,
      );
    }

    try {
      const existingProviderSettings = await this.runQuery<{ id: string }>(
        "SELECT id FROM provider_settings WHERE user_id = ? AND id = ?",
        [userId, providerId],
        true,
      );

      if (!existingProviderSettings) {
        throw new AssistantError(
          "Provider settings not found",
          ErrorType.PARAMS_ERROR,
        );
      }

      const result = await this.runQuery<{ public_key: string }>(
        "SELECT public_key FROM user_settings WHERE user_id = ?",
        [userId],
        true,
      );

      if (!result?.public_key) {
        throw new AssistantError(
          "User settings not found",
          ErrorType.NOT_FOUND,
        );
      }

      const publicKeyJwk = JSON.parse(result.public_key);

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

      const keyToEncrypt = secretKey
        ? `${apiKey}${UserSettingsRepository.CREDENTIALS_DELIMITER}${secretKey}`
        : apiKey;

      const encryptedData = await crypto.subtle.encrypt(
        {
          name: "RSA-OAEP",
          label: new TextEncoder().encode("provider-api-key"),
        },
        publicKey,
        new TextEncoder().encode(keyToEncrypt),
      );

      const encryptedApiKey = bufferToBase64(new Uint8Array(encryptedData));

      await this.executeRun(
        "UPDATE provider_settings SET api_key = ?, enabled = 1 WHERE user_id = ? AND id = ?",
        [encryptedApiKey, userId, existingProviderSettings.id],
      );
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      throw new AssistantError(
        "Failed to store provider API key",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  }

  public async getProviderApiKey(
    userId: number,
    providerId: string,
  ): Promise<string | null> {
    if (!this.env.DB) {
      throw new AssistantError(
        "Database is not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    if (!userId || !providerId) {
      throw new AssistantError(
        "Missing required parameters",
        ErrorType.PARAMS_ERROR,
      );
    }

    try {
      const userSettings = await this.runQuery<{ private_key: string }>(
        "SELECT private_key FROM user_settings WHERE user_id = ?",
        [userId],
        true,
      );

      if (!userSettings?.private_key) {
        throw new AssistantError(
          "User settings not found",
          ErrorType.NOT_FOUND,
        );
      }

      const decryptedPrivateKeyString = await this.decryptWithServerKey(
        userSettings.private_key,
      );
      const privateKeyJwk = JSON.parse(decryptedPrivateKeyString);

      const privateKey = await crypto.subtle.importKey(
        "jwk",
        privateKeyJwk,
        {
          name: "RSA-OAEP",
          hash: "SHA-256",
        },
        true,
        ["decrypt"],
      );

      const result = await this.runQuery<{ api_key: string }>(
        "SELECT api_key FROM provider_settings WHERE user_id = ? AND provider_id = ?",
        [userId, providerId],
        true,
      );

      if (!result?.api_key) {
        return null;
      }

      const decryptedApiKey = await crypto.subtle.decrypt(
        {
          name: "RSA-OAEP",
          label: new TextEncoder().encode("provider-api-key"),
        },
        privateKey,
        decodeBase64(result.api_key),
      );

      return new TextDecoder().decode(decryptedApiKey);
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      throw new AssistantError(
        "Failed to retrieve provider API key",
        ErrorType.UNKNOWN_ERROR,
      );
    }
  }

  public async createUserProviderSettings(userId: number): Promise<void> {
    const providers = AIProviderFactory.getConfigurableProviders();
    const defaultProviders = AIProviderFactory.getDefaultProviders();

    await Promise.all(
      providers.map(async (provider) => {
        const existingSettings = await this.runQuery<{ id: string }>(
          "SELECT id FROM provider_settings WHERE user_id = ? AND provider_id = ?",
          [userId, provider],
          true,
        );

        if (existingSettings) {
          return;
        }

        const providerSettingsId = crypto.randomUUID();

        const isEnabled = defaultProviders.includes(provider);

        await this.executeRun(
          "INSERT INTO provider_settings (id, user_id, provider_id, enabled) VALUES (?, ?, ?, ?)",
          [providerSettingsId, userId, provider, isEnabled ? 1 : 0],
        );
      }),
    );
  }

  public async getUserProviderSettings(
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    const result = await this.runQuery<{
      id: string;
      provider_id: string;
      enabled: number;
    }>(
      "SELECT id, provider_id, enabled FROM provider_settings WHERE user_id = ?",
      [userId],
    );

    return result.map((provider) => ({
      id: provider.id,
      provider_id: provider.provider_id,
      enabled: provider.enabled === 1,
    }));
  }
}
