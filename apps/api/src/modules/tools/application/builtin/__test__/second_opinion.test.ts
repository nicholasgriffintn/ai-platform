import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser, Message } from "~/types";

const mocks = vi.hoisted(() => ({
  getLineupModelsForUser: vi.fn(),
  resolveTierModel: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-models")>()),
  resolveTierModel: mocks.resolveTierModel,
}));
vi.mock("~/modules/models/application/resolve", () => ({
  getLineupModelsForUser: mocks.getLineupModelsForUser,
}));

import { readReviewMaterial, resolveReviewers } from "../second_opinion";

const env = {} as IEnv;
const user = { id: 1 } as IUser;
const models = [
  { matchingModel: "a", provider: "one", name: "A" },
  { matchingModel: "b", provider: "two", name: "B" },
  { matchingModel: "c", provider: "two", name: "C" },
] as ModelConfigItem[];

describe("resolveReviewers", () => {
  beforeEach(() => {
    mocks.getLineupModelsForUser.mockResolvedValue({});
    mocks.resolveTierModel.mockReset();
    mocks.resolveTierModel.mockImplementation((_lineup, _user, _tier, _mode, { isEligible }) => {
      const config = models.find(isEligible);

      return config ? { config } : null;
    });
  });

  it("picks two reviewers from different vendors", async () => {
    const reviewers = await resolveReviewers(env, user, "other");

    expect(reviewers.map((reviewer) => reviewer.provider)).toEqual(["one", "two"]);
  });

  it("never asks the model that answered", async () => {
    const reviewers = await resolveReviewers(env, user, "a");

    expect(reviewers.map((reviewer) => reviewer.model)).toEqual(["b"]);
  });
});

describe("readReviewMaterial", () => {
  const history: Message[] = [
    { role: "user", content: "Earlier question" },
    { role: "tool", name: "web_search", content: "Earlier result" },
    { role: "assistant", content: "Earlier answer" },
    { role: "user", content: "List the tools" },
    { role: "assistant", content: "", tool_calls: [{ id: "call_1" }] },
    { role: "tool", name: "mcp_list_tools", content: "ask_wiki_question" },
    { role: "tool", name: "private", content: "hidden", data: { modelContext: false } },
    { role: "assistant", content: "It offers ask_wiki_question" },
    { role: "user", content: "Get a second opinion" },
    { role: "assistant", content: "", tool_calls: [{ id: "call_2" }] },
  ];

  it("gives reviewers the question and only the tool results behind the answer", () => {
    expect(readReviewMaterial(history)).toEqual({
      answer: "It offers ask_wiki_question",
      question: "List the tools",
      toolResults: "mcp_list_tools:\nask_wiki_question",
    });
  });

  it("keeps that evidence when the model passes the answer itself", () => {
    expect(readReviewMaterial(history, "Rewritten answer")).toEqual({
      answer: "Rewritten answer",
      question: "List the tools",
      toolResults: "mcp_list_tools:\nask_wiki_question",
    });
  });
});
