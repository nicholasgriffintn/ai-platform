import { ProviderRegistry } from "./registry/ProviderRegistry";
import type { ProviderCategory } from "./registry/types";
import { registerAudioProviders } from "./registry/registrations/audio";
import { registerChatProviders } from "./registry/registrations/chat";
import { registerEmbeddingProviders } from "./registry/registrations/embedding";
import { registerResearchProviders } from "./registry/registrations/research";
import { registerSearchProviders } from "./registry/registrations/search";
import { registerTranscriptionProviders } from "./registry/registrations/transcription";
import type {
	CategoryProviderMap,
	ProviderFactoryContext,
	ProviderRegistration,
	ProviderSummary,
} from "./registry/types";

type CategoryBootstrapper = (registry: ProviderRegistry) => void;

const DEFAULT_BOOTSTRAPPERS: Partial<
	Record<ProviderCategory, CategoryBootstrapper[]>
> = {
	audio: [registerAudioProviders],
	chat: [registerChatProviders],
	embedding: [registerEmbeddingProviders],
	research: [registerResearchProviders],
	search: [registerSearchProviders],
	transcription: [registerTranscriptionProviders],
};

export class ProviderLibrary {
	private static instance: ProviderLibrary;
	private readonly registry: ProviderRegistry;
	private readonly bootstrappers = new Map<
		ProviderCategory,
		CategoryBootstrapper[]
	>();
	private readonly bootstrappedCategories = new Set<ProviderCategory>();

	private constructor(
		registry?: ProviderRegistry,
		bootstrappers = DEFAULT_BOOTSTRAPPERS,
	) {
		this.registry = registry ?? new ProviderRegistry();

		for (const [category, categoryBootstrappers] of Object.entries(
			bootstrappers,
		)) {
			this.bootstrappers.set(category as ProviderCategory, [
				...(categoryBootstrappers ?? []),
			]);
		}
	}

	static getInstance(): ProviderLibrary {
		if (!ProviderLibrary.instance) {
			ProviderLibrary.instance = new ProviderLibrary();
		}

		return ProviderLibrary.instance;
	}

	registerBootstrapper(
		category: ProviderCategory,
		bootstrapper: CategoryBootstrapper,
	): void {
		const existing = this.bootstrappers.get(category) ?? [];
		existing.push(bootstrapper);
		this.bootstrappers.set(category, existing);
		this.bootstrappedCategories.delete(category);
	}

	register<TCategory extends ProviderCategory>(
		category: TCategory,
		registration: ProviderRegistration<CategoryProviderMap[TCategory]>,
	): void {
		this.registry.register(category, registration);
	}

	resolve<TCategory extends ProviderCategory>(
		category: TCategory,
		providerName: string,
		context?: ProviderFactoryContext,
	): CategoryProviderMap[TCategory] {
		this.ensureBootstrapped(category);
		return this.registry.resolve(category, providerName, context);
	}

	chat(providerName: string, context?: ProviderFactoryContext) {
		return this.resolve("chat", providerName, context);
	}

	audio(providerName: string, context?: ProviderFactoryContext) {
		return this.resolve("audio", providerName, context);
	}

	search(providerName: string, context?: ProviderFactoryContext) {
		return this.resolve("search", providerName, context);
	}

	research(providerName: string, context?: ProviderFactoryContext) {
		return this.resolve("research", providerName, context);
	}

	embedding(providerName: string, context?: ProviderFactoryContext) {
		return this.resolve("embedding", providerName, context);
	}

	transcription(providerName: string, context?: ProviderFactoryContext) {
		return this.resolve("transcription", providerName, context);
	}

	list(category?: ProviderCategory): ProviderSummary[] {
		if (category) {
			this.ensureBootstrapped(category);
		}

		return this.registry.list(category);
	}

	private ensureBootstrapped(category: ProviderCategory): void {
		if (this.bootstrappedCategories.has(category)) {
			return;
		}

		const bootstrappers = this.bootstrappers.get(category) ?? [];
		for (const bootstrapper of bootstrappers) {
			bootstrapper(this.registry);
		}

		this.bootstrappedCategories.add(category);
	}
}

export const providerLibrary = ProviderLibrary.getInstance();
