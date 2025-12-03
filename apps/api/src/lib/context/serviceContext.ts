import type { D1Database } from "@cloudflare/workers-types";
import type { Context, MiddlewareHandler } from "hono";

import type { IEnv, IUser, IUserSettings } from "~/types";
import { Database } from "~/lib/database";
import { RepositoryManager } from "~/repositories";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	createRequestCache,
	memoizeRequest,
	type RequestCache,
} from "~/utils/requestCache";
import type { LoggerOptions } from "~/utils/logger";
import { getLogger } from "~/utils/logger";

export interface ServiceContextOptions {
	env: IEnv;
	user?: IUser | null;
	requestId?: string;
}

export interface ServiceContext {
	env: IEnv;
	user?: IUser | null;
	requestId?: string;
	database: Database;
	repositories: RepositoryManager;
	requestCache: RequestCache;
	userSettings: IUserSettings | null;
	requireUser(): IUser;
	ensureDatabase(): D1Database;
	getUserSettings(): Promise<IUserSettings | null>;
	setUserSettings(settings: IUserSettings | null): void;
	getLogger(options?: LoggerOptions): ReturnType<typeof getLogger>;
}

export const createServiceContext = ({
	env,
	user = null,
	requestId,
}: ServiceContextOptions): ServiceContext => {
	let _database: Database | null = null;
	let _repositories: RepositoryManager | null = null;
	const requestCache = createRequestCache();
	let cachedUserSettings: IUserSettings | null | undefined = undefined;
	let userSettingsPromise: Promise<IUserSettings | null> | null = null;

	const ensureDatabase = (): D1Database => {
		if (!env.DB) {
			throw new AssistantError(
				"Database not configured",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return env.DB;
	};

	const requireUser = (): IUser => {
		if (!user?.id) {
			throw new AssistantError(
				"User is not authenticated",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		return user;
	};

	const loadUserSettings = async (): Promise<IUserSettings | null> => {
		if (!user?.id) {
			cachedUserSettings = null;
			return null;
		}

		if (cachedUserSettings !== undefined) {
			return cachedUserSettings;
		}

		if (!userSettingsPromise) {
			userSettingsPromise = memoizeRequest(
				requestCache,
				`user-settings:${user.id}`,
				async () => {
					if (!_repositories) {
						_repositories = new RepositoryManager(env);
					}
					const settings = await _repositories.userSettings.getUserSettings(
						user.id,
					);
					return settings;
				},
			);
		}

		cachedUserSettings = await userSettingsPromise;
		return cachedUserSettings;
	};

	const setUserSettings = (settings: IUserSettings | null) => {
		cachedUserSettings = settings;
		userSettingsPromise = Promise.resolve(settings);
	};

	const getContextLogger = (options?: LoggerOptions) => {
		return getLogger({
			...options,
			requestId,
		});
	};

	return {
		env,
		user,
		requestId,
		requestCache,
		get userSettings() {
			return cachedUserSettings ?? null;
		},
		get database() {
			if (!_database) _database = new Database(env);
			return _database;
		},
		get repositories() {
			if (!_repositories) _repositories = new RepositoryManager(env);
			return _repositories;
		},
		requireUser,
		ensureDatabase,
		getUserSettings: loadUserSettings,
		setUserSettings,
		getLogger: getContextLogger,
	};
};

const SERVICE_CONTEXT_KEY = "serviceContext";

export interface ResolveServiceContextOptions {
	context?: ServiceContext;
	env?: IEnv;
	user?: IUser | null;
	requestId?: string;
}

export const resolveServiceContext = ({
	context,
	env,
	user = null,
	requestId,
}: ResolveServiceContextOptions): ServiceContext => {
	if (context) {
		return context;
	}

	if (!env) {
		throw new AssistantError(
			"Service context requires environment",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return createServiceContext({
		env,
		user,
		requestId,
	});
};

export const serviceContextMiddleware: MiddlewareHandler = async (c, next) => {
	const existing = c.get(SERVICE_CONTEXT_KEY);
	if (!existing) {
		const user = c.get("user") as IUser | null | undefined;
		const requestId = c.get("requestId") as string | undefined;
		const context = createServiceContext({
			env: c.env as IEnv,
			user: user ?? null,
			requestId,
		});
		c.set(SERVICE_CONTEXT_KEY, context);
	}

	await next();
};

export const getServiceContext = (c: Context): ServiceContext => {
	const existing = c.get(SERVICE_CONTEXT_KEY) as ServiceContext | undefined;
	if (existing) {
		return existing;
	}

	const user = c.get("user") as IUser | null | undefined;
	const requestId = c.get("requestId") as string | undefined;
	const context = createServiceContext({
		env: c.env as IEnv,
		user: user ?? null,
		requestId,
	});
	c.set(SERVICE_CONTEXT_KEY, context);
	return context;
};
