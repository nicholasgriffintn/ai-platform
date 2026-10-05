import { describe, expect, it } from "vitest";

import type { IRequest } from "~/types";

import { request_approval, ask_user } from "../human_in_the_loop";
import { validateFunctionArgs } from "../index";

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

  it("throws error for missing message", async () => {
    await expect(request_approval.execute({}, createToolContext(baseRequest))).rejects.toThrow();
  });
});

describe("ask_user", () => {
  it("normalises the compact question shape emitted by providers", () => {
    expect(
      validateFunctionArgs(ask_user, {
        message: "What product name should we use?",
        choices: ["Polychat Connect", "FlowSync", "Nexus", "Orbit", "Pulse", "Extra"],
      }),
    ).toEqual({
      questions: [
        {
          id: "what-product-name-should-we-use",
          prompt: "What product name should we use?",
          options: [
            { label: "Polychat Connect" },
            { label: "FlowSync" },
            { label: "Nexus" },
            { label: "Orbit" },
            { label: "Pulse" },
          ],
          allowOther: true,
        },
      ],
    });
  });

  it("normalises nested question fields and string options", () => {
    expect(
      validateFunctionArgs(ask_user, {
        questions: [
          {
            question: "Which audience is this for?",
            options: ["Customers", "Internal teams"],
          },
        ],
      }),
    ).toEqual({
      questions: [
        {
          id: "which-audience-is-this-for",
          prompt: "Which audience is this for?",
          options: [{ label: "Customers" }, { label: "Internal teams" }],
          allowOther: true,
        },
      ],
    });
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
