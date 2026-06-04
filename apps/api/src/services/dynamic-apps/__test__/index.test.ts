import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppSchema } from "~/types/app-schema";
import type { IRequest } from "~/types";
import { executeDynamicApp, registerDynamicApp } from "../index";

vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: vi.fn(),
	},
}));

vi.mock("~/services/functions", () => ({
	handleFunctions: vi.fn(),
}));

const baseApp: Omit<AppSchema, "id"> = {
	name: "Dynamic App Test",
	description: "Exercises dynamic app execution persistence",
	formSchema: {
		steps: [
			{
				id: "details",
				title: "Details",
				fields: [
					{
						id: "topic",
						type: "text",
						label: "Topic",
						required: true,
					},
				],
			},
		],
	},
	responseSchema: {
		type: "json",
		display: {},
	},
};

const dynamicAppResponseRepository = {
	createResponse: vi.fn(),
	updateResponseData: vi.fn(),
};

function createRequest(overrides: Partial<IRequest> = {}): IRequest {
	const env = {
		DB: {},
		CACHE: null,
	} as any;

	return {
		app_url: "https://app.example.com",
		context: {
			database: {},
			env,
			repositories: {
				dynamicAppResponses: dynamicAppResponseRepository,
			},
			requestCache: new Map(),
		} as any,
		env,
		request: {
			completion_id: "completion-123",
		} as any,
		user: {
			id: 42,
		} as any,
		...overrides,
	} as IRequest;
}

let appSequence = 0;

function registerTestApp() {
	appSequence += 1;

	const appId = `dynamic-app-test-${appSequence}`;
	registerDynamicApp({
		...baseApp,
		id: appId,
	});

	return appId;
}

describe("executeDynamicApp", () => {
	beforeEach(async () => {
		vi.clearAllMocks();

		dynamicAppResponseRepository.createResponse.mockReset();
		dynamicAppResponseRepository.updateResponseData.mockReset();

		const { ConversationManager } = await import("~/lib/conversationManager");
		vi.mocked(ConversationManager.getInstance).mockReturnValue({} as any);
	});

	it("persists async dynamic app results and adds the stored response id to async context", async () => {
		const { handleFunctions } = await import("~/services/functions");
		const appId = registerTestApp();
		const formData = { topic: "Agents" };
		const functionResult = {
			success: true,
			data: {
				asyncInvocation: {
					id: "async-123",
					context: {
						source: "queue",
					},
				},
			},
		};

		vi.mocked(handleFunctions).mockResolvedValue(functionResult as any);

		const createResponseSpy = dynamicAppResponseRepository.createResponse.mockResolvedValue({
			id: "response-123",
		} as any);
		const updateResponseDataSpy =
			dynamicAppResponseRepository.updateResponseData.mockResolvedValue(undefined);

		const result = await executeDynamicApp(appId, formData, createRequest());

		expect(createResponseSpy).toHaveBeenCalledWith(
			42,
			appId,
			{
				formData,
				result: functionResult,
			},
			"async-123",
		);
		expect(updateResponseDataSpy).toHaveBeenCalledWith(
			"response-123",
			expect.objectContaining({
				formData,
				result: expect.objectContaining({
					data: expect.objectContaining({
						asyncInvocation: expect.objectContaining({
							id: "async-123",
							context: {
								source: "queue",
								responseId: "response-123",
							},
						}),
					}),
				}),
			}),
		);
		expect(result).toMatchObject({
			success: true,
			response_id: "response-123",
			data: {
				input: formData,
				result: {
					data: {
						asyncInvocation: {
							id: "async-123",
							context: {
								source: "queue",
								responseId: "response-123",
							},
						},
					},
				},
			},
		});
	});

	it("returns async execution results without persisting them for anonymous requests", async () => {
		const { handleFunctions } = await import("~/services/functions");
		const appId = registerTestApp();
		const functionResult = {
			success: true,
			data: {
				asyncInvocation: {
					id: "async-456",
					context: {
						source: "queue",
					},
				},
			},
		};

		vi.mocked(handleFunctions).mockResolvedValue(functionResult as any);

		const createResponseSpy = dynamicAppResponseRepository.createResponse;
		const updateResponseDataSpy = dynamicAppResponseRepository.updateResponseData;

		const result = await executeDynamicApp(
			appId,
			{ topic: "Anonymous" },
			createRequest({ user: undefined as any }),
		);

		expect(createResponseSpy).not.toHaveBeenCalled();
		expect(updateResponseDataSpy).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			success: true,
			data: {
				result: functionResult,
			},
		});
		expect(result.response_id).toBeUndefined();
	});
});
