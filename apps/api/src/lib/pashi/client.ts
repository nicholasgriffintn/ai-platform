import type { IEnv } from "~/types";
import { readEnvString } from "~/utils/env";
import { getPashiToolFields, isPashiToolExecutable } from "./catalog";
import {
	pashiInfoSchema,
	type PashiInfo,
	type PashiOperation,
	type PashiOperationResult,
	type PashiTool,
} from "./contracts";

const PASHI_ORIGIN = "https://pashi.app";
const PASHI_INFO_PATH = "/api/info";
const PASHI_CONFIGURATION_ERROR_MESSAGE = "PASHI_API_KEY is required to access Pashi.";
const DEFAULT_CATALOG_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10_000;

export type PashiClientErrorCode =
	| "catalog_unavailable"
	| "configuration_error"
	| "invalid_catalog"
	| "invalid_input"
	| "timeout"
	| "tool_not_found"
	| "tool_unavailable"
	| "upstream_error";

export class PashiClientError extends Error {
	constructor(
		public readonly code: PashiClientErrorCode,
		message: string,
		public readonly status?: number,
	) {
		super(message);
		this.name = "PashiClientError";
	}
}

interface PashiClientOptions {
	apiKey: string;
	catalogTtlMs?: number;
	fetch?: typeof fetch;
	now?: () => number;
	timeoutMs?: number;
}

export class PashiClient {
	private readonly apiKey: string;
	private readonly catalogTtlMs: number;
	private readonly fetch: typeof fetch;
	private readonly now: () => number;
	private readonly timeoutMs: number;
	private cachedInfo?: { expiresAt: number; value: PashiInfo };
	private pendingInfo?: Promise<PashiInfo>;

	constructor(options: PashiClientOptions) {
		const apiKey = readEnvString(options.apiKey);
		if (!apiKey) {
			throw new PashiClientError("configuration_error", PASHI_CONFIGURATION_ERROR_MESSAGE);
		}

		this.apiKey = apiKey;
		this.catalogTtlMs = options.catalogTtlMs ?? DEFAULT_CATALOG_TTL_MS;
		this.fetch = options.fetch ?? fetch;
		this.now = options.now ?? Date.now;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	async getInfo(): Promise<PashiInfo> {
		if (this.cachedInfo && this.cachedInfo.expiresAt > this.now()) {
			return this.cachedInfo.value;
		}
		if (this.pendingInfo) {
			return this.pendingInfo;
		}

		this.pendingInfo = this.fetchInfo();
		try {
			const value = await this.pendingInfo;
			this.cachedInfo = {
				expiresAt: this.now() + this.catalogTtlMs,
				value,
			};
			return value;
		} finally {
			this.pendingInfo = undefined;
		}
	}

	async execute(operation: PashiOperation): Promise<PashiOperationResult> {
		const info = await this.getInfo();
		const tool = info.tools.find((candidate) => candidate.id === operation.toolId);
		if (!tool) {
			throw new PashiClientError(
				"tool_not_found",
				`Pashi tool "${operation.toolId}" was not found. Refresh discovery before retrying.`,
			);
		}

		if (!isPashiToolExecutable(tool)) {
			throw new PashiClientError(
				"tool_unavailable",
				tool.input.kind === "file"
					? `Pashi tool "${tool.id}" requires a file upload, which this integration does not support yet.`
					: `Pashi tool "${tool.id}" is currently unavailable.`,
			);
		}
		const fields = validateOperation(tool, operation);

		if (tool.toolType === "generator" && tool.result?.kind === "image") {
			return {
				data: {
					imageUrl: buildPashiImageUrl(tool, operation.input, fields),
				},
				resultKind: "image",
				toolId: tool.id,
				toolType: tool.toolType,
			};
		}

		const data = await this.requestJson(tool.endpoint, {
			body: JSON.stringify({
				fields,
				input: operation.input ?? "",
			}),
			headers: {
				"Content-Type": "application/json",
			},
			method: "POST",
		});

		return {
			data,
			resultKind: tool.result?.kind ?? "fields",
			toolId: tool.id,
			toolType: tool.toolType,
		};
	}

	private async fetchInfo(): Promise<PashiInfo> {
		let data: unknown;
		try {
			data = await this.requestJson(PASHI_INFO_PATH, {
				headers: {
					Accept: "application/json",
				},
			});
		} catch (error) {
			if (error instanceof PashiClientError) {
				throw new PashiClientError(
					error.code === "timeout" ? "timeout" : "catalog_unavailable",
					error.code === "timeout"
						? "Pashi catalogue request timed out."
						: "Pashi catalogue is currently unavailable.",
					error.status,
				);
			}
			throw error;
		}

		const parsed = pashiInfoSchema.safeParse(data);
		if (!parsed.success) {
			throw new PashiClientError(
				"invalid_catalog",
				"Pashi returned a catalogue that does not match the supported contract.",
			);
		}

		for (const tool of parsed.data.tools) {
			resolvePashiUrl(tool.endpoint);
		}
		return parsed.data;
	}

	private async requestJson(path: string, init: RequestInit): Promise<unknown> {
		const url = resolvePashiUrl(path);
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

		let response: Response;
		try {
			response = await this.fetch(url, {
				...init,
				headers: {
					Accept: "application/json",
					...init.headers,
					Authorization: `Bearer ${this.apiKey}`,
				},
				signal: controller.signal,
			});
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				throw new PashiClientError("timeout", "Pashi request timed out.");
			}
			throw new PashiClientError("upstream_error", "Pashi request failed.");
		} finally {
			clearTimeout(timeoutId);
		}

		const body = await response.text();
		if (!response.ok) {
			throw new PashiClientError(
				"upstream_error",
				`Pashi request failed with status ${response.status}.`,
				response.status,
			);
		}

		try {
			return JSON.parse(body);
		} catch {
			throw new PashiClientError(
				"upstream_error",
				"Pashi returned an invalid JSON response.",
				response.status,
			);
		}
	}
}

const clientsByEnvironment = new WeakMap<
	Pick<IEnv, "PASHI_API_KEY">,
	{ apiKey: string; client: PashiClient }
>();

export function getPashiClient(env: Pick<IEnv, "PASHI_API_KEY">): PashiClient {
	const apiKey = readEnvString(env.PASHI_API_KEY);
	if (!apiKey) {
		throw new PashiClientError("configuration_error", PASHI_CONFIGURATION_ERROR_MESSAGE);
	}

	const cached = clientsByEnvironment.get(env);
	if (cached?.apiKey === apiKey) {
		return cached.client;
	}

	const client = new PashiClient({ apiKey });
	clientsByEnvironment.set(env, { apiKey, client });
	return client;
}

function resolvePashiUrl(path: string): string {
	const url = new URL(path, PASHI_ORIGIN);
	if (url.origin !== PASHI_ORIGIN || !url.pathname.startsWith("/api/")) {
		throw new PashiClientError("invalid_catalog", "Pashi returned an unsafe API endpoint.");
	}

	return url.toString();
}

function validateOperation(tool: PashiTool, operation: PashiOperation): Record<string, string> {
	const input = operation.input ?? "";
	const fields = operation.fields ?? {};
	const entries = Object.entries(fields);

	const descriptors = getPashiToolFields(tool);
	const descriptorById = new Map(descriptors.map((field) => [field.id, field]));
	const unknownField = entries.find(([id]) => !descriptorById.has(id));
	if (unknownField) {
		throw new PashiClientError(
			"invalid_input",
			`Field "${unknownField[0]}" is not supported by Pashi tool "${tool.id}".`,
		);
	}

	const missingField = descriptors.find(
		(field) => field.required && !(field.id in fields) && field.defaultValue === undefined,
	);
	if (missingField) {
		throw new PashiClientError(
			"invalid_input",
			`Field "${missingField.id}" is required by Pashi tool "${tool.id}".`,
		);
	}

	for (const [id, value] of entries) {
		const descriptor = descriptorById.get(id);
		const allowedValues = descriptor?.options ?? descriptor?.values;
		if (allowedValues?.length && !allowedValues.includes(value)) {
			throw new PashiClientError(
				"invalid_input",
				`Field "${id}" must be one of: ${allowedValues.join(", ")}.`,
			);
		}
	}

	const hasStructuredFields = descriptors.length > 0;
	const requiresInput =
		tool.toolType === "converter"
			? tool.input.required
			: tool.input.mode !== "none" && tool.input.required && !hasStructuredFields;
	if (requiresInput && !input.trim()) {
		throw new PashiClientError(
			"invalid_input",
			`Pashi tool "${tool.id}" requires ${tool.input.label.toLowerCase()}.`,
		);
	}

	return fields;
}

function buildPashiImageUrl(
	tool: PashiTool,
	input: string | undefined,
	fields: Record<string, string>,
): string {
	const url = new URL(resolvePashiUrl(tool.endpoint));
	url.searchParams.set("generate", "1");
	if (input) {
		url.searchParams.set("input", input);
	}
	for (const [key, value] of Object.entries(fields)) {
		url.searchParams.set(key, value);
	}

	return url.toString();
}
