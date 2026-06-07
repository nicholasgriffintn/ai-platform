import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "~/lib/tools/ToolExecutionContext";
import type { IEnv, IRequest, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
	executeRecipeConnectorOperation: vi.fn(),
}));

vi.mock("~/services/apps/connectors/operations", () => ({
	executeRecipeConnectorOperation: mocks.executeRecipeConnectorOperation,
}));

import { use_recipe_connector } from "../recipe_connectors";

function createToolContext(allowedConnectorProviders?: string[]) {
	const env = {} as IEnv;
	const user = { id: 42 } as IUser;
	const request: IRequest = {
		env,
		context: {} as IRequest["context"],
		user,
		request: {
			completion_id: "completion-id",
			input: "use a connector",
			date: "2026-06-07T10:00:00.000Z",
			...(allowedConnectorProviders === undefined
				? {}
				: {
						options: {
							recipe: {
								id: "notion-action-log",
								allowedConnectorProviders,
							},
						},
					}),
		},
	};

	return {
		completionId: "completion-id",
		env,
		user,
		request,
	} satisfies ToolExecutionContext;
}

describe("recipe connector tools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.executeRecipeConnectorOperation.mockResolvedValue({ ok: true });
	});

	it("rejects connector operations outside the active recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "gmail",
				operation: "search_messages",
				params: { query: "from:example" },
			},
			createToolContext(["notion"]),
		);

		expect(result).toEqual({
			status: "error",
			name: "use_recipe_connector",
			content: "The gmail connector is not enabled for this recipe.",
			data: {
				provider: "gmail",
				allowedConnectorProviders: ["notion"],
			},
		});
		expect(mocks.executeRecipeConnectorOperation).not.toHaveBeenCalled();
	});

	it("allows connector operations included in the active recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "notion",
				operation: "search",
				params: { query: "Action log" },
			},
			createToolContext(["notion"]),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "notion",
				operation: "search",
				params: { query: "Action log" },
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("keeps manually enabled connector tools unrestricted when no recipe scope is present", async () => {
		await use_recipe_connector.execute(
			{
				provider: "gmail",
				operation: "search_messages",
			},
			createToolContext(),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith(
			expect.objectContaining({
				request: expect.objectContaining({
					provider: "gmail",
				}),
			}),
		);
	});
});
