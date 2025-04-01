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
    const stringifiedPrivateKey = JSON.stringify(publicKey);

    const userSettingsId = crypto.randomUUID();

    await this.executeRun(
      `INSERT INTO user_settings (id, user_id, public_key, private_key)
       VALUES (?, ?, ?, ?)`,
      [
        userSettingsId,
        userId,
        stringifiedPrivateKey,
        encryptedPrivateKeyString,
      ],
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
    return result as Promise<Record<string, unknown> | null>;
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
}
