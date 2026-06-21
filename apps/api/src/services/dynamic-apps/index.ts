import { ConversationManager } from "~/lib/conversationManager";
import { getDynamicAppFormErrors, type AppSchema } from "@assistant/schemas";
import { getFeaturedApps, type FeaturedAppDefinition } from "~/services/dynamic-apps/config";
import { handleFunctions } from "~/services/functions";
import type { IRequest } from "~/types";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { AppData } from "~/repositories/AppDataRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/dynamic-apps" });

const dynamicApps = new Map<string, AppSchema>();

/**
 * Register a new dynamic app
 * @param app The app schema to register
 * @returns The registered app
 */
export const registerDynamicApp = (app: AppSchema): AppSchema => {
	if (dynamicApps.has(app.id)) {
		throw new AssistantError(`App with ID ${app.id} already exists`, ErrorType.PARAMS_ERROR);
	}

	dynamicApps.set(app.id, {
		...app,
		kind: "dynamic",
	});
	return app;
};

/**
 * Get all registered dynamic apps
 * @returns Array of all registered apps (basic info only)
 */
export const getDynamicApps = async (): Promise<
	Array<Omit<AppSchema, "formSchema" | "responseSchema"> & { kind: "dynamic" }>
> => {
	return Array.from(dynamicApps.values()).map(
		({
			id,
			name,
			description,
			icon,
			category,
			theme,
			tags,
			featured,
			costPerCall,
			isDefault,
			type,
		}) => ({
			id,
			name,
			description,
			icon,
			category,
			theme,
			tags,
			featured,
			costPerCall,
			isDefault,
			type,
			kind: "dynamic" as const,
		}),
	);
};

type DynamicAppCatalogItem =
	| (Omit<AppSchema, "formSchema" | "responseSchema"> & { kind: "dynamic" })
	| (FeaturedAppDefinition & { featured: true });

export const getDynamicAppCatalog = async (): Promise<DynamicAppCatalogItem[]> => {
	const apps = await getDynamicApps();
	const featuredApps = getFeaturedApps();
	const mergedApps = new Map<string, DynamicAppCatalogItem>();

	for (const app of apps) {
		mergedApps.set(app.id, {
			...app,
			featured: app.featured ?? false,
			kind: app.kind ?? "dynamic",
		});
	}

	for (const featuredApp of featuredApps) {
		const existing = mergedApps.get(featuredApp.id);
		mergedApps.set(featuredApp.id, {
			...existing,
			...featuredApp,
			featured: true,
			kind: featuredApp.kind ?? existing?.kind ?? (featuredApp.href ? "frontend" : "dynamic"),
		} as DynamicAppCatalogItem);
	}

	return Array.from(mergedApps.values());
};

/**
 * Get a specific dynamic app by ID
 * @param id The app ID
 * @returns The app schema or null if not found
 */
export const getDynamicAppById = async (id: string): Promise<AppSchema | null> => {
	return dynamicApps.get(id) || null;
};

const getDynamicAppServiceContext = (req: IRequest): ServiceContext => {
	if (!req.context) {
		throw new AssistantError(
			"Dynamic app execution requires a service context",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return req.context;
};

/**
 * Execute a dynamic app with the provided form data
 * @param id The app ID
 * @param formData The form data submitted by the user
 * @param req The request object
 * @returns The execution result
 */
export const executeDynamicApp = async (
	id: string,
	formData: Record<string, any>,
	req: IRequest,
): Promise<Record<string, any>> => {
	const app = dynamicApps.get(id);

	if (!app) {
		throw new AssistantError(`App with ID ${id} not found`, ErrorType.NOT_FOUND, 404);
	}

	validateFormData(app, formData);

	const { anonymousUser, env, user } = req;
	const serviceContext = getDynamicAppServiceContext(req);

	const conversationManager = ConversationManager.getInstance({
		database: serviceContext.database,
		user,
		anonymousUser,
		store: !!user?.id,
		platform: "dynamic-apps",
		env,
		requestCache: serviceContext.requestCache,
		repositories: serviceContext.repositories,
	});

	try {
		if (app.kind === "dynamic") {
			const functionName = app.id;
			let functionResult = await handleFunctions({
				completion_id: req.request?.completion_id || "dynamic-app-execution",
				app_url: req.app_url,
				functionName,
				args: formData,
				request: req,
				conversationManager,
			});

			let response_id: string | undefined;
			if (user?.id) {
				const resultData = (functionResult?.data ?? {}) as Record<string, any>;
				const runId =
					(resultData?.run?.run_id as string | undefined) ??
					(resultData?.asyncInvocation?.id as string | undefined);

				const saved = await createDynamicAppResponse(
					serviceContext,
					user.id,
					id,
					{
						formData,
						result: functionResult,
					},
					runId,
				);
				response_id = saved.id;

				const asyncInvocation = resultData?.asyncInvocation;
				if (asyncInvocation) {
					const augmentedResult = {
						...functionResult,
						data: {
							...resultData,
							asyncInvocation: {
								...asyncInvocation,
								context: {
									...asyncInvocation.context,
									responseId: saved.id,
								},
							},
						},
					};

					functionResult = augmentedResult;

					await serviceContext.repositories.dynamicAppResponses.updateResponseData(saved.id, {
						formData,
						result: augmentedResult,
					});
				}
			}

			return {
				success: true,
				response_id,
				data: {
					message: `Successfully executed ${app.name}`,
					timestamp: new Date().toISOString(),
					input: formData,
					result: functionResult,
				},
			};
		}

		return {
			success: false,
		};
	} catch (error) {
		logger.error(`Error executing app ${id}:`, { error });
		throw error;
	}
};

/**
 * Validate form data against the app's schema
 * @param app The app schema
 * @param formData The form data to validate
 */
const validateFormData = (app: AppSchema, formData: Record<string, any>): void => {
	const errors = getDynamicAppFormErrors(app, formData);
	const firstError = Object.values(errors)[0];

	if (firstError) {
		throw new AssistantError(firstError, ErrorType.PARAMS_ERROR);
	}
};

/**
 * Create a response for a dynamic app execution
 * @param context The request service context
 * @param userId The user ID
 * @param appId The app ID
 * @param payload The response payload
 * @returns The created response
 */
export const createDynamicAppResponse = async (
	context: ServiceContext,
	userId: number,
	appId: string,
	payload: Record<string, any>,
	itemId?: string,
): Promise<AppData> => {
	return context.repositories.dynamicAppResponses.createResponse(userId, appId, payload, itemId);
};

/**
 * Get a dynamic app response by ID
 * @param context The request service context
 * @param userId The user ID that owns the response
 * @param responseId The response ID
 * @returns The response data or null if not found
 */
export const getDynamicAppResponseById = async (
	context: ServiceContext,
	userId: number,
	responseId: string,
): Promise<AppData | null> => {
	return context.repositories.dynamicAppResponses.getResponseByIdForUser(responseId, userId);
};

/**
 * List dynamic app responses for a user
 * @param context The request service context
 * @param userId The user ID
 * @param appId Optional app ID to filter by
 * @returns Array of response data
 */
export const listDynamicAppResponsesForUser = async (
	context: ServiceContext,
	userId: number,
	appId?: string,
): Promise<AppData[]> => {
	return context.repositories.dynamicAppResponses.listResponsesForUser(userId, appId);
};
