import { describe, expect, it } from "vitest";
import { request_approval, ask_user } from "../human_in_the_loop";
import type { IRequest } from "~/types";

const baseRequest: IRequest = {
	env: {} as any,
	user: { id: 1, plan_id: "pro" } as any,
};

const createToolContext = (
	request: IRequest,
	completionId = "completion_id",
) => ({
	completionId,
	env: request.env,
	user: request.user,
	request,
});

describe("request_approval", () => {
	it("creates an approval request with minimal parameters", async () => {
		const result = await request_approval.execute(
			{ message: "Do you want to proceed with this action?" },
			createToolContext(baseRequest),
		);

		expect(result.status).toBe("pending");
		expect(result.name).toBe("request_approval");
		expect(result.content).toBe("Do you want to proceed with this action?");
		expect(result.data?.humanInTheLoop).toBeDefined();
		expect(result.data?.humanInTheLoop.type).toBe("approval");
		expect(result.data?.humanInTheLoop.status).toBe("pending");
		expect(result.data?.humanInTheLoop.requires_user_action).toBe(true);
		expect(result.data?.options).toEqual(["Approve", "Reject"]);
	});

	it("creates an approval request with custom options", async () => {
		const result = await request_approval.execute(
			{
				message: "Choose an action",
				options: ["Yes", "No", "Maybe"],
			},
			createToolContext(baseRequest),
		);

		expect(result.status).toBe("pending");
		expect(result.data?.options).toEqual(["Yes", "No", "Maybe"]);
	});

	it("includes context data when provided", async () => {
		const result = await request_approval.execute(
			{
				message: "Approve deletion?",
				context: { resource_id: "123", action: "delete" },
			},
			createToolContext(baseRequest),
		);

		expect(result.data?.context).toEqual({
			resource_id: "123",
			action: "delete",
		});
	});

	it("parses JSON string options", async () => {
		const result = await request_approval.execute(
			{
				message: "Test",
				options: JSON.stringify(["Option A", "Option B"]),
			},
			createToolContext(baseRequest),
		);

		expect(result.data?.options).toEqual(["Option A", "Option B"]);
	});

	it("throws error for empty message", async () => {
		await expect(
			request_approval.execute({ message: "" }, createToolContext(baseRequest)),
		).rejects.toThrow("non-empty string");
	});

	it("throws error for missing message", async () => {
		await expect(
			request_approval.execute({}, createToolContext(baseRequest)),
		).rejects.toThrow();
	});
});

describe("ask_user", () => {
	it("creates a question with minimal parameters", async () => {
		const result = await ask_user.execute(
			{ question: "What is your email address?" },
			createToolContext(baseRequest),
		);

		expect(result.status).toBe("pending");
		expect(result.name).toBe("ask_user");
		expect(result.content).toBe("What is your email address?");
		expect(result.data?.humanInTheLoop).toBeDefined();
		expect(result.data?.humanInTheLoop.type).toBe("question");
		expect(result.data?.humanInTheLoop.status).toBe("pending");
		expect(result.data?.humanInTheLoop.requires_user_action).toBe(true);
	});

	it("creates a question with expected format", async () => {
		const result = await ask_user.execute(
			{
				question: "How many items?",
				expected_format: "a number between 1-100",
			},
			createToolContext(baseRequest),
		);

		expect(result.status).toBe("pending");
		expect(result.data?.expected_format).toBe("a number between 1-100");
	});

	it("creates a question with suggestions", async () => {
		const result = await ask_user.execute(
			{
				question: "Which color?",
				suggestions: ["Red", "Green", "Blue"],
			},
			createToolContext(baseRequest),
		);

		expect(result.status).toBe("pending");
		expect(result.data?.suggestions).toEqual(["Red", "Green", "Blue"]);
	});

	it("includes context data when provided", async () => {
		const result = await ask_user.execute(
			{
				question: "Confirm details?",
				context: { step: 3, workflow: "onboarding" },
			},
			createToolContext(baseRequest),
		);

		expect(result.data?.context).toEqual({
			step: 3,
			workflow: "onboarding",
		});
	});

	it("parses JSON string suggestions", async () => {
		const result = await ask_user.execute(
			{
				question: "Test",
				suggestions: JSON.stringify(["Yes", "No"]),
			},
			createToolContext(baseRequest),
		);

		expect(result.data?.suggestions).toEqual(["Yes", "No"]);
	});

	it("throws error for empty question", async () => {
		await expect(
			ask_user.execute({ question: "" }, createToolContext(baseRequest)),
		).rejects.toThrow("non-empty string");
	});

	it("throws error for missing question", async () => {
		await expect(
			ask_user.execute({}, createToolContext(baseRequest)),
		).rejects.toThrow();
	});
});
