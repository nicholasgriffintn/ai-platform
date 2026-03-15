import type { ToolDefinition, ToolResult } from "@assistant/schemas";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { ToolExecutionContext } from "./ToolExecutionContext";

export type ToolCategory = string;
export type ToolLifecycle = "singleton" | "transient";

export type RegisteredToolDefinition<
	TInput = unknown,
	TResult extends ToolResult = ToolResult,
> = ToolDefinition<TInput, TResult, ToolExecutionContext>;

export interface ToolRegistration<
	TInput = unknown,
	TResult extends ToolResult = ToolResult,
> {
	name: string;
	aliases?: string[];
	lifecycle?: ToolLifecycle;
	metadata?: Record<string, unknown>;
	create: () => RegisteredToolDefinition<TInput, TResult>;
}

export interface ToolSummary {
	name: string;
	category: ToolCategory;
	aliases?: string[];
	metadata?: Record<string, unknown>;
	permissions?: string[];
}

type InternalRegistration = ToolRegistration & {
	id: string;
	instance?: RegisteredToolDefinition;
};

export class ToolRegistry {
	private readonly categories = new Map<
		ToolCategory,
		Map<string, InternalRegistration>
	>();

	register(category: ToolCategory, registration: ToolRegistration): void {
		const key = registration.name.toLowerCase();
		const store = this.getOrCreateCategoryStore(category);

		if (store.has(key)) {
			throw new AssistantError(
				`Tool "${registration.name}" already registered for category "${category}"`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const internalRegistration: InternalRegistration = {
			...registration,
			id: key,
			lifecycle: registration.lifecycle ?? "singleton",
		};

		store.set(key, internalRegistration);

		registration.aliases?.forEach((alias) => {
			store.set(alias.toLowerCase(), internalRegistration);
		});
	}

	resolve(category: ToolCategory, toolName: string): RegisteredToolDefinition {
		const store = this.categories.get(category);
		if (!store) {
			throw new AssistantError(
				`No tools registered for category "${category}"`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const registration = store.get(toolName.toLowerCase());
		if (!registration) {
			throw new AssistantError(
				`Unknown ${category} tool "${toolName}"`,
				ErrorType.PARAMS_ERROR,
			);
		}

		if (registration.lifecycle === "singleton") {
			if (!registration.instance) {
				registration.instance = registration.create();
			}

			return registration.instance;
		}

		return registration.create();
	}

	list(category?: ToolCategory): ToolSummary[] {
		if (category) {
			return this.listByCategory(category);
		}

		const summaries: ToolSummary[] = [];
		for (const categoryKey of this.categories.keys()) {
			summaries.push(...this.listByCategory(categoryKey));
		}

		return summaries;
	}

	listDefinitions(category: ToolCategory): RegisteredToolDefinition[] {
		const store = this.categories.get(category);
		if (!store) {
			return [];
		}

		const seen = new Set<string>();
		const definitions: RegisteredToolDefinition[] = [];

		for (const registration of store.values()) {
			if (seen.has(registration.id)) {
				continue;
			}

			seen.add(registration.id);
			definitions.push(this.resolve(category, registration.name));
		}

		return definitions;
	}

	private listByCategory(category: ToolCategory): ToolSummary[] {
		const store = this.categories.get(category);
		if (!store) {
			return [];
		}

		const seen = new Set<string>();
		const summaries: ToolSummary[] = [];

		for (const registration of store.values()) {
			if (seen.has(registration.id)) {
				continue;
			}

			seen.add(registration.id);
			summaries.push({
				name: registration.name,
				category,
				aliases: registration.aliases,
				metadata: registration.metadata,
				permissions: registration.instance?.permissions,
			});
		}

		summaries.sort((a, b) => a.name.localeCompare(b.name));
		return summaries;
	}

	private getOrCreateCategoryStore(category: ToolCategory) {
		if (!this.categories.has(category)) {
			this.categories.set(category, new Map());
		}

		return this.categories.get(category)!;
	}
}
