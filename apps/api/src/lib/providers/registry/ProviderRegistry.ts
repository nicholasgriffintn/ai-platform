import { AssistantError, ErrorType } from "~/utils/errors";
import type {
	CategoryProviderMap,
	ProviderCategory,
	ProviderFactoryContext,
	ProviderRegistration,
	ProviderSummary,
} from "./types";

type InternalRegistration<TInstance> = ProviderRegistration<TInstance> & {
	id: string;
	instance?: TInstance;
};

export class ProviderRegistry {
	private readonly categories = new Map<
		ProviderCategory,
		Map<string, InternalRegistration<any>>
	>();

	register<TCategory extends ProviderCategory>(
		category: TCategory,
		registration: ProviderRegistration<CategoryProviderMap[TCategory]>,
	): void {
		const key = registration.name.toLowerCase();
		const store = this.getOrCreateCategoryStore(category);

		if (store.has(key)) {
			throw new AssistantError(
				`Provider "${registration.name}" already registered for category "${category}"`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const internalRegistration: InternalRegistration<any> = {
			...registration,
			id: key,
			lifecycle: registration.lifecycle ?? "singleton",
		};

		store.set(key, internalRegistration);

		registration.aliases?.forEach((alias) => {
			store.set(alias.toLowerCase(), internalRegistration);
		});
	}

	resolve<TCategory extends ProviderCategory>(
		category: TCategory,
		providerName: string,
		context: ProviderFactoryContext = {},
	): CategoryProviderMap[TCategory] {
		const store = this.categories.get(category);
		if (!store) {
			throw new AssistantError(
				`No providers registered for category "${category}"`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const registration = store.get(providerName.toLowerCase());
		if (!registration) {
			throw new AssistantError(
				`Unknown ${category} provider "${providerName}"`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		if (registration.lifecycle === "singleton") {
			if (!registration.instance) {
				registration.instance = registration.create(context);
			}
			return registration.instance;
		}

		return registration.create(context);
	}

	list(category?: ProviderCategory): ProviderSummary[] {
		if (category) {
			return this.listByCategory(category);
		}

		const result: ProviderSummary[] = [];
		for (const categoryKey of this.categories.keys()) {
			result.push(...this.listByCategory(categoryKey));
		}
		return result;
	}

	private listByCategory(category: ProviderCategory): ProviderSummary[] {
		const store = this.categories.get(category);
		if (!store) {
			return [];
		}

		const seen = new Set<string>();
		const summaries: ProviderSummary[] = [];

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
			});
		}

		summaries.sort((a, b) => a.name.localeCompare(b.name));
		return summaries;
	}

	private getOrCreateCategoryStore(category: ProviderCategory) {
		if (!this.categories.has(category)) {
			this.categories.set(category, new Map());
		}

		return this.categories.get(category)!;
	}
}
