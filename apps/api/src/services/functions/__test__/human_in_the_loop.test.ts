import { describe, expect, it } from "vitest";

import type { IRequest } from "~/types";

import { request_approval, ask_user } from "../human_in_the_loop";

const baseRequest: IRequest = {
  env: {} as any,
  user: { id: 1, plan_id: "pro" } as any,
};

const createToolContext = (request: IRequest, completionId = "completion_id") => ({
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
    await expect(request_approval.execute({}, createToolContext(baseRequest))).rejects.toThrow();
  });
});

describe("ask_user", () => {
  it("creates one structured question", async () => {
    const result = await ask_user.execute(
      { questions: [{ id: "email", prompt: "What is your email address?" }] },
      createToolContext(baseRequest),
    );

    expect(result.status).toBe("pending");
    expect(result.name).toBe("ask_user");
    expect(result.content).toBe("What is your email address?");
    expect(result.data?.humanInTheLoop).toBeDefined();
    expect(result.data?.humanInTheLoop.type).toBe("question");
    expect(result.data?.humanInTheLoop.status).toBe("pending");
    expect(result.data?.humanInTheLoop.requires_user_action).toBe(true);
    expect(result.data?.questions).toEqual([
      {
        id: "email",
        prompt: "What is your email address?",
        options: [],
        allowOther: true,
      },
    ]);
    expect(result.data?.interactionId).toEqual(expect.any(String));
  });

  it("creates up to three questions with described choices", async () => {
    const result = await ask_user.execute(
      {
        questions: [
          {
            id: "tone",
            prompt: "Which tone should the launch note use?",
            options: [
              { label: "Friendly", description: "Warm and conversational." },
              { label: "Direct", description: "Concise and factual." },
            ],
          },
          {
            id: "audience",
            prompt: "Who is the audience?",
            options: [{ label: "Existing customers" }],
          },
        ],
      },
      createToolContext(baseRequest),
    );

    expect(result.status).toBe("pending");
    expect(result.content).toBe("Waiting for answers to 2 questions.");
    expect(result.data?.questions[0].options).toEqual([
      { label: "Friendly", description: "Warm and conversational." },
      { label: "Direct", description: "Concise and factual." },
    ]);
  });

  it("rejects duplicate question ids", async () => {
    await expect(
      ask_user.execute(
        {
          questions: [
            { id: "detail", prompt: "First detail?" },
            { id: "detail", prompt: "Second detail?" },
          ],
        },
        createToolContext(baseRequest),
      ),
    ).rejects.toThrow("between one and three valid questions");
  });

  it("rejects missing questions", async () => {
    await expect(ask_user.execute({}, createToolContext(baseRequest))).rejects.toThrow();
  });
});
