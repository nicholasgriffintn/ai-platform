import type { MemoryProvider } from "../../capabilities/memory";
import {
	BuiltInMemoryProvider,
	HindsightMemoryProvider,
	HonchoMemoryProvider,
} from "../../capabilities/memory/providers";
import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import { ensureEnv, ensureUser } from "./utils";

const HINDSIGHT_API_BASE_URL = "https://hindsight.vectorize.io";
const HONCHO_API_BASE_URL = "https://api.honcho.dev";

const memoryProviders: ProviderRegistration<MemoryProvider>[] = [
	{
		name: "built-in",
		aliases: ["builtin", "vectorize"],
		lifecycle: "transient",
		create: (context) =>
			new BuiltInMemoryProvider(
				ensureEnv(context),
				ensureUser(context, { optional: true }),
				context.userSettings,
			),
		metadata: {
			vendor: "Polychat",
			categories: ["memory"],
			description: "Built-in D1 and Vectorize-backed assistant memories.",
		},
	},
	{
		name: "hindsight",
		lifecycle: "transient",
		create: (context) =>
			new HindsightMemoryProvider({
				baseUrl: HINDSIGHT_API_BASE_URL,
				env: ensureEnv(context),
				user: ensureUser(context, { optional: true }),
				serviceContext: context.serviceContext,
			}),
		metadata: {
			vendor: "Vectorize",
			website: "https://hindsight.vectorize.io/",
			categories: ["memory"],
			description: "External Hindsight memory with retain, recall, and reflect support.",
		},
	},
	{
		name: "honcho",
		lifecycle: "transient",
		create: (context) =>
			new HonchoMemoryProvider({
				baseUrl: HONCHO_API_BASE_URL,
				env: ensureEnv(context),
				user: ensureUser(context, { optional: true }),
				serviceContext: context.serviceContext,
			}),
		metadata: {
			vendor: "Honcho",
			website: "https://honcho.dev/",
			categories: ["memory"],
			description: "External Honcho memory with peer reasoning and session context.",
		},
	},
];

export function registerMemoryProviders(registry: ProviderRegistry): void {
	for (const registration of memoryProviders) {
		registry.register("memory", registration);
	}
}
