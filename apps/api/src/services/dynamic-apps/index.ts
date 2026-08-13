import { ConversationManager } from "~/lib/conversationManager";
import {
	getDynamicAppFormErrors,
	type AppSchema,
	type AssistantCapabilityDescriptor,
} from "@ngriffin_uk/polychat-schemas";
import { getFeaturedApps, type FeaturedAppCatalogDefinition } from "~/services/dynamic-apps/config";
import { handleFunctions } from "~/services/functions";
import type { IRequest } from "~/types";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord } from "~/repositories/OutputRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { createDynamicAppCapabilityDescriptor } from "./capabilities";
import { requireProjectAccess } from "~/services/workspaces/access";

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
	| (Omit<AppSchema, "formSchema" | "responseSchema"> & {
			kind: "dynamic";
			capability?: AssistantCapabilityDescriptor;
	  })
	| (FeaturedAppCatalogDefinition & {
			featured: true;
			capability?: AssistantCapabilityDescriptor;
	  });

export const getDynamicAppCatalog = async (): Promise<DynamicAppCatalogItem[]> => {
	const apps = await getDynamicApps();
	const featuredApps = getFeaturedApps();
	const mergedApps = new Map<string, DynamicAppCatalogItem>();

	for (const app of apps) {
		mergedApps.set(app.id, {
			...app,
			featured: app.featured ?? false,
			kind: app.kind ?? "dynamic",
			capability: createDynamicAppCapabilityDescriptor(app),
		});
	}

	for (const featuredApp of featuredApps) {
		const existing = mergedApps.get(featuredApp.id);
		const catalogItem = {
			...existing,
			...featuredApp,
			featured: true,
			kind: featuredApp.kind ?? existing?.kind ?? (featuredApp.href ? "frontend" : "dynamic"),
		} as DynamicAppCatalogItem;
		mergedApps.set(featuredApp.id, {
			...catalogItem,
			capability: createDynamicAppCapabilityDescriptor(catalogItem),
		});
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
): Promise<Record<string, any>> => executeDynamicAppRuntime(id, formData, req);

export const executeProjectDynamicApp = async (
	id: string,
	formData: Record<string, any>,
	req: IRequest,
	projectId: string,
): Promise<Record<string, any>> => {
	const serviceContext = getDynamicAppServiceContext(req);
	await requireProjectAccess(serviceContext, projectId);
	const projectCapabilities =
		await serviceContext.repositories.workspaces.listProjectCapabilities(projectId);
	if (
		!projectCapabilities.some(
			(capability) => capability.kind === "app" && capability.capability_id === id,
		)
	) {
		throw new AssistantError("App is not available in this project", ErrorType.NOT_FOUND, 404);
	}

	return executeDynamicAppRuntime(id, formData, req, projectId);
};

const executeDynamicAppRuntime = async (
	id: string,
	formData: Record<string, any>,
	req: IRequest,
	projectId?: string,
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

			let output_id: string | undefined;
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
					projectId,
				);
				output_id = saved.id;

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

					await serviceContext.repositories.outputs.updateOutput(saved.id, {
						content: { formData, result: augmentedResult },
						expectedRevision: saved.revision,
						updatedByUserId: user.id,
					});
				}
			}

			return {
				success: true,
				output_id,
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
	projectId?: string,
): Promise<OutputRecord> => {
	return context.repositories.outputs.createOutput({
		createdByUserId: userId,
		projectId,
		capabilityId: appId,
		groupId: itemId,
		kind: "dynamic_app_response",
		title: `App output: ${appId}`,
		content: payload,
	});
};
