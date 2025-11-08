import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { ResearchProvider } from "~/types";
import {
	ParallelResearchProvider,
	ExaResearchProvider,
} from "../../capabilities/research/providers";
import { ensureEnv, ensureUser } from "./utils";

const researchProviders: ProviderRegistration<ResearchProvider>[] = [
	{
		name: "parallel",
		create: (context) => {
			const env = ensureEnv(context);
			const user = ensureUser(context, { optional: true });
			return new ParallelResearchProvider(env, user);
		},
		metadata: { vendor: "Parallel", categories: ["research"] },
	},
	{
		name: "exa",
		create: (context) => {
			const env = ensureEnv(context);
			const user = ensureUser(context, { optional: true });
			return new ExaResearchProvider(env, user);
		},
		metadata: { vendor: "Exa", categories: ["research"] },
	},
];

export function registerResearchProviders(registry: ProviderRegistry): void {
	for (const registration of researchProviders) {
		registry.register("research", registration);
	}
}
