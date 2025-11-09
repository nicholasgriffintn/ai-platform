import { decodeBase64 } from "hono/utils/encode";

import { getModels } from "~/lib/providers/models";
import { listConfigurableChatProviders } from "~/lib/providers/capabilities/chat";
import type { IUserSettings } from "~/types";
import { bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseRepository } from "./BaseRepository";
import { generateId } from "~/utils/id";
import { safeParseJson } from "../utils/json";

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
		} catch (_error) {
			throw new AssistantError(
				"Failed to encrypt data",
				ErrorType.UNKNOWN_ERROR,
			);
		}
	}

	private async decryptWithServerKey(encryptedData: string): Promise<string> {
		try {
			const key = await this.getServerEncryptionKey();
			let parsedEncryptedData = safeParseJson(encryptedData);
			if (!parsedEncryptedData) {
				throw new AssistantError(
					"Failed to parse encrypted data",
					ErrorType.INTERNAL_ERROR,
				);
			}
			const { iv, data } = parsedEncryptedData;

			const decryptedData = await crypto.subtle.decrypt(
				{ name: "AES-GCM", iv: decodeBase64(iv) },
				key,
				decodeBase64(data),
			);

			return new TextDecoder().decode(decryptedData);
		} catch (_error) {
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

			const userSettingsId = generateId();

			const insert = this.buildInsertQuery("user_settings", {
				id: userSettingsId,
				user_id: userId,
				public_key: publicKeyString,
				private_key: encryptedPrivateKeyString,
			});

			if (!insert) {
				throw new AssistantError(
					"Failed to create user settings",
					ErrorType.UNKNOWN_ERROR,
				);
			}

			await this.executeRun(insert.query, insert.values);
		} catch (_error) {
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
		const updates: Record<string, unknown> = {
			nickname: settings.nickname ?? null,
			job_role: settings.job_role ?? null,
			traits: settings.traits ?? null,
			preferences: settings.preferences ?? null,
			tracking_enabled:
				settings.tracking_enabled !== undefined
					? settings.tracking_enabled
						? 1
						: 0
					: null,
			guardrails_enabled:
				settings.guardrails_enabled !== undefined
					? settings.guardrails_enabled
						? 1
						: 0
					: null,
			guardrails_provider: settings.guardrails_provider ?? null,
			bedrock_guardrail_id: settings.bedrock_guardrail_id ?? null,
			bedrock_guardrail_version: settings.bedrock_guardrail_version ?? null,
			embedding_provider: settings.embedding_provider ?? null,
			bedrock_knowledge_base_id: settings.bedrock_knowledge_base_id ?? null,
			bedrock_knowledge_base_custom_data_source_id:
				settings.bedrock_knowledge_base_custom_data_source_id ?? null,
			s3vectors_bucket_name: settings.s3vectors_bucket_name ?? null,
			s3vectors_index_name: settings.s3vectors_index_name ?? null,
			s3vectors_region: settings.s3vectors_region ?? null,
			memories_save_enabled:
				settings.memories_save_enabled !== undefined
					? settings.memories_save_enabled
						? 1
						: 0
					: null,
			memories_chat_history_enabled:
				settings.memories_chat_history_enabled !== undefined
					? settings.memories_chat_history_enabled
						? 1
						: 0
					: null,
			transcription_provider: settings.transcription_provider ?? null,
			transcription_model: settings.transcription_model ?? null,
			search_provider: settings.search_provider ?? null,
		};

		const allowedFields = Object.keys(updates);

		const result = this.buildUpdateQuery(
			"user_settings",
			updates,
			allowedFields,
			"user_id = ?",
			[userId],
		);

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
			"transcription_provider",
			"transcription_model",
			"search_provider",
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
			memories_chat_history_enabled: Boolean(
				result.memories_chat_history_enabled,
			),
		} as IUserSettings;
	}

	public async getUserEnabledModels(
		userId: number,
	): Promise<Record<string, unknown>[]> {
		const { query, values } = this.buildSelectQuery(
			"model_settings",
			{ user_id: userId },
			{ columns: ["id", "model_id", "enabled"] },
		);
		const userModels = (await this.runQuery<{
			model_id: string;
			enabled: number;
		}>(query, values)) as { model_id: string; enabled: number }[];

		const userModelMap = new Map(
			userModels.map((model) => [model.model_id, model.enabled === 1]),
		);

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
			const { query: providerQuery, values: providerValues } =
				this.buildSelectQuery(
					"provider_settings",
					{ user_id: userId, id: providerId },
					{ columns: ["id"] },
				);
			const existingProviderSettings = await this.runQuery<{ id: string }>(
				providerQuery,
				providerValues,
				true,
			);

			if (!existingProviderSettings) {
				throw new AssistantError(
					"Provider settings not found",
					ErrorType.PARAMS_ERROR,
				);
			}

			const { query: publicKeyQuery, values: publicKeyValues } =
				this.buildSelectQuery(
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
				throw new AssistantError(
					"User settings not found",
					ErrorType.NOT_FOUND,
				);
			}

			let publicKeyJwk = safeParseJson(result.public_key);
			if (!publicKeyJwk) {
				throw new AssistantError(
					"Failed to parse public key",
					ErrorType.INTERNAL_ERROR,
				);
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
			const { query: settingsQuery, values: settingsValues } =
				this.buildSelectQuery(
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
				throw new AssistantError(
					"User settings not found",
					ErrorType.NOT_FOUND,
				);
			}

			const decryptedPrivateKeyString = await this.decryptWithServerKey(
				userSettings.private_key,
			);
			let privateKeyJwk = safeParseJson(decryptedPrivateKeyString);
			if (!privateKeyJwk) {
				throw new AssistantError(
					"Failed to parse private key",
					ErrorType.INTERNAL_ERROR,
				);
			}

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

			const { query: providerQuery, values: providerValues } =
				this.buildSelectQuery(
					"provider_settings",
					{ user_id: userId, provider_id: providerId },
					{ columns: ["api_key"] },
				);
			const result = await this.runQuery<{ api_key: string }>(
				providerQuery,
				providerValues,
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
		const providers = listConfigurableChatProviders();
		const alwaysEnabledProviders = this.env.ALWAYS_ENABLED_PROVIDERS || "";
		const defaultProviders = alwaysEnabledProviders?.split(",") || [];

		await Promise.all(
			providers.map(async (provider) => {
				const { query, values } = this.buildSelectQuery(
					"provider_settings",
					{ user_id: userId, provider_id: provider },
					{ columns: ["id"] },
				);
				const existingSettings = await this.runQuery<{ id: string }>(
					query,
					values,
					true,
				);

				if (existingSettings) {
					return;
				}

				const providerSettingsId = generateId();

				const isEnabled = defaultProviders.includes(provider);

				const insert = this.buildInsertQuery("provider_settings", {
					id: providerSettingsId,
					user_id: userId,
					provider_id: provider,
					enabled: isEnabled ? 1 : 0,
				});

				if (insert) {
					await this.executeRun(insert.query, insert.values);
				}
			}),
		);
	}

	public async getUserProviderSettings(
		userId: number,
	): Promise<Record<string, unknown>[]> {
		const { query, values } = this.buildSelectQuery(
			"provider_settings",
			{ user_id: userId },
			{ columns: ["id", "provider_id", "enabled"] },
		);

		const result = await this.runQuery<{
			id: string;
			provider_id: string;
			enabled: number;
		}>(query, values);

		return result.map((provider) => ({
			id: provider.id,
			provider_id: provider.provider_id,
			enabled: provider.enabled === 1,
		}));
	}
}
