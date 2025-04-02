import { decodeBase64 } from "hono/utils/encode";
import { getModels } from "../lib/models";
import { bufferToBase64 } from "../utils/base64";
import { BaseRepository } from "./BaseRepository";

export class UserSettingsRepository extends BaseRepository {
  private async getServerEncryptionKey() {
    if (!this.env.PRIVATE_KEY) {
      throw new Error("Server key not configured");
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
  }

  private async decryptWithServerKey(encryptedData: string): Promise<string> {
    const key = await this.getServerEncryptionKey();
    const { iv, data } = JSON.parse(encryptedData);

    const decryptedData = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64(iv) },
      key,
      decodeBase64(data),
    );

    return new TextDecoder().decode(decryptedData);
  }

  public async createUserSettings(userId: number): Promise<void> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
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

    const userSettingsId = crypto.randomUUID();

    await this.executeRun(
      `INSERT INTO user_settings (id, user_id, public_key, private_key)
       VALUES (?, ?, ?, ?)`,
      [userSettingsId, userId, publicKeyString, encryptedPrivateKeyString],
    );
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
        userId,
      ],
    );
  }

  public async getUserSettings(
    userId: number,
  ): Promise<Record<string, unknown> | null> {
    const result = this.runQuery<Record<string, unknown>>(
      "SELECT id, nickname, job_role, traits, preferences, tracking_enabled FROM user_settings WHERE user_id = ?",
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
  ): Promise<void> {
    if (!this.env.DB) {
      throw new Error("DB is not configured");
    }

    if (!userId || !providerId || !apiKey) {
      throw new Error("Invalid parameters");
    }

    const existingProviderSettings = await this.runQuery<{ id: string }>(
      "SELECT id FROM provider_settings WHERE user_id = ? AND provider_id = ?",
      [userId, providerId],
      true,
    );

    if (existingProviderSettings) {
      throw new Error(
        "Provider settings already exist, please delete them first.",
      );
    }

    const result = await this.runQuery<{ public_key: string }>(
      "SELECT public_key FROM user_settings WHERE user_id = ?",
      [userId],
      true,
    );

    if (!result?.public_key) {
      throw new Error("Public key not found");
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

    const encryptedData = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      new TextEncoder().encode(apiKey),
    );

    const encryptedApiKey = bufferToBase64(new Uint8Array(encryptedData));

    const providerSettingsId = crypto.randomUUID();

    await this.executeRun(
      "INSERT INTO provider_settings (id, user_id, provider_id, api_key, enabled) VALUES (?, ?, ?, ?, ?)",
      [providerSettingsId, userId, providerId, encryptedApiKey, 1],
    );
  }

  public async getProviderApiKey(
    userId: number,
    providerId: string,
  ): Promise<string | null> {
    if (!this.env.DB) {
      throw new Error("DB is not configured");
    }

    if (!userId || !providerId) {
      throw new Error("Invalid parameters");
    }

    const userSettings = await this.runQuery<{ private_key: string }>(
      "SELECT private_key FROM user_settings WHERE user_id = ?",
      [userId],
      true,
    );

    if (!userSettings?.private_key) {
      throw new Error("Private key not found");
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
      { name: "RSA-OAEP" },
      privateKey,
      decodeBase64(result.api_key),
    );

    return new TextDecoder().decode(decryptedApiKey);
  }
}
