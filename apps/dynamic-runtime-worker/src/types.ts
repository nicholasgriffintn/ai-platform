export type DynamicWorkerTailEvent = {
	logs: Array<{ level: string; message: string }>;
};

export type DynamicWorkerEntrypoint = {
	fetch: (request: Request) => Promise<Response>;
	[key: string]: unknown;
};

export type DynamicWorkerStub = {
	getEntrypoint(name?: string): DynamicWorkerEntrypoint;
};

export type DynamicWorkerCode = {
	compatibilityDate: string;
	mainModule: string;
	modules: Record<string, string>;
	env?: Record<string, unknown>;
	globalOutbound?: unknown | null;
	tails?: unknown[];
};

export type DynamicWorkerLoader = {
	load(code: DynamicWorkerCode): DynamicWorkerStub;
};

export interface Env {
	JWT_SECRET?: string;
	LOADER: DynamicWorkerLoader;
	POLYCHAT_API: Fetcher;
}
