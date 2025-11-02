import { bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { BaseRepository } from "./BaseRepository";
import { generateId } from "~/utils/id";

const logger = getLogger({ prefix: "repositories/ApiKeyRepository" });

export interface ApiKeyMetadata {
  id: string;
  name: string;
  created_at: string;
}

export class ApiKeyRepository extends BaseRepository {
  private async getUserPublicKey(userId: number): Promise<CryptoKey> {
    const result = await this.runQuery<{ public_key: string }>(
      "SELECT public_key FROM user_settings WHERE user_id = ?",
      [userId],
      true,
    );

    if (!result?.public_key) {
      throw new AssistantError("User settings not found", ErrorType.NOT_FOUND);
    }

    let publicKeyJwk;
    try {
      publicKeyJwk = JSON.parse(result.public_key);
    } catch (e) {
      logger.error("Failed to parse public key", { error: e });
      throw new AssistantError(
        "Failed to parse public key",
        ErrorType.INTERNAL_ERROR,
      );
    }

    try {
      return await crypto.subtle.importKey(
        "jwk",
        publicKeyJwk,
        {
          name: "RSA-OAEP",
          hash: "SHA-256",
        },
        false,
        ["encrypt"],
      );
    } catch (error) {
      logger.error("Error importing public key:", { error });
      throw new AssistantError(
        "Failed to import user public key",
        ErrorType.INTERNAL_ERROR,
      );
    }
  }

  private async encryptApiKey(
    apiKey: string,
    publicKey: CryptoKey,
  ): Promise<string> {
    try {
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: "RSA-OAEP",
        },
        publicKey,
        new TextEncoder().encode(apiKey),
      );
      return bufferToBase64(new Uint8Array(encryptedData));
    } catch (error) {
      logger.error("Error encrypting API key:", { error });
      throw new AssistantError(
        "Failed to encrypt API key",
        ErrorType.INTERNAL_ERROR,
      );
    }
  }

  private async hashApiKey(apiKey: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hashHex;
    } catch (error) {
      logger.error("Error hashing API key:", { error });
      throw new AssistantError(
        "Failed to hash API key",
        ErrorType.INTERNAL_ERROR,
      );
    }
  }

  private generateNewApiKey(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const key = bufferToBase64(randomBytes);
    return `ak_${key}`;
  }

  public async createApiKey(
    userId: number,
    name: string,
  ): Promise<{ plaintextKey: string; metadata: ApiKeyMetadata }> {
    if (!userId) {
      throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
    }

    const plaintextKey = this.generateNewApiKey();
    const hashedKey = await this.hashApiKey(plaintextKey);
    const publicKey = await this.getUserPublicKey(userId);
    const encryptedKey = await this.encryptApiKey(plaintextKey, publicKey);

    const apiKeyId = generateId();
    const keyName = name || `API Key ${new Date().toISOString()}`;

    try {
      await this.executeRun(
        `INSERT INTO user_api_keys (id, user_id, name, api_key, hashed_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [apiKeyId, userId, keyName, encryptedKey, hashedKey],
      );

      const metadata: ApiKeyMetadata = {
        id: apiKeyId,
        name: keyName,
        created_at: new Date().toISOString(),
      };

      return { plaintextKey, metadata };
    } catch (error: any) {
      if (
        error.message?.includes(
          "UNIQUE constraint failed: user_api_keys.hashed_key",
        )
      ) {
        logger.error("API Key hash collision (rare):", { error });
        throw new AssistantError(
          "Failed to create API key due to a hash collision. Please try again.",
          ErrorType.INTERNAL_ERROR,
        );
      }
      logger.error("Error inserting API key:", { error });
      throw new AssistantError(
        "Failed to create API key in database",
        ErrorType.INTERNAL_ERROR,
      );
    }
  }

  public async getUserApiKeys(userId: number): Promise<ApiKeyMetadata[]> {
    if (!userId) {
      throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
    }

    try {
      const results = await this.runQuery<{
        id: string;
        name: string;
        created_at: string;
      }>(
        "SELECT id, name, created_at FROM user_api_keys WHERE user_id = ? ORDER BY created_at DESC",
        [userId],
      );
      return results;
    } catch (error) {
      logger.error("Error retrieving API keys:", { error });
      throw new AssistantError(
        "Failed to retrieve API keys",
        ErrorType.INTERNAL_ERROR,
      );
    }
  }

  public async deleteApiKey(userId: number, apiKeyId: string): Promise<void> {
    if (!userId || !apiKeyId) {
      throw new AssistantError(
        "User ID and API Key ID are required",
        ErrorType.PARAMS_ERROR,
      );
    }

    try {
      const result = await this.executeRun(
        "DELETE FROM user_api_keys WHERE id = ? AND user_id = ?",
        [apiKeyId, userId],
      );

      if (!result) {
        throw new AssistantError("API key not found", ErrorType.NOT_FOUND);
      }
    } catch (error) {
      logger.error("Error deleting API key:", { error });
      throw new AssistantError(
        "Failed to delete API key",
        ErrorType.INTERNAL_ERROR,
      );
    }
  }

  public async findUserIdByApiKey(apiKey: string): Promise<number | null> {
    if (!apiKey) {
      return null;
    }

    try {
      const hashedKey = await this.hashApiKey(apiKey);
      const result = await this.runQuery<{ user_id: number }>(
        "SELECT user_id FROM user_api_keys WHERE hashed_key = ?",
        [hashedKey],
        true,
      );
      return result?.user_id ?? null;
    } catch (error) {
      logger.error("Error finding user by API key hash:", { error });
      return null;
    }
  }
}
