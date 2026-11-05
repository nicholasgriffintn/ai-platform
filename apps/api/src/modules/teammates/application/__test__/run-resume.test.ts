import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ResponseCommand } from "~/modules/responses/domain/command";

import { withRoutineBounds } from "../run-resume";

const readRecipeResumeOptions = vi.hoisted(() => vi.fn());

vi.mock("~/modules/recipes/application", () => ({ readRecipeResumeOptions }));

const context = {} as ServiceContext;
const interaction = { toolName: "call_api", response: { interactionId: "call_1" } };
const body: ResponseCommand = {
  conversationId: "recipe_task_1",
  messages: [],
  settings: { options: { toolInteraction: interaction } },
};
const routineRun = { initiatorUserId: 7, recipeInstallationId: "install_1" } as ChatRun;

describe("withRoutineBounds", () => {
  beforeEach(() => readRecipeResumeOptions.mockReset());

  it("keeps a resumed routine inside its recipe's connector allowlist", async () => {
    const recipe = {
      id: "poly-inbox-triage",
      channel: "web",
      allowedConnectorOperations: { gmail: ["GMAIL_FETCH_EMAILS"] },
    };

    readRecipeResumeOptions.mockResolvedValue(recipe);

    await expect(withRoutineBounds(context, routineRun, body)).resolves.toMatchObject({
      settings: { options: { toolInteraction: interaction, recipe } },
    });
  });

  it("refuses to resume once the routine has gone", async () => {
    readRecipeResumeOptions.mockResolvedValue(null);

    await expect(withRoutineBounds(context, routineRun, body)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("leaves other runs alone", async () => {
    await expect(withRoutineBounds(context, null, body)).resolves.toBe(body);
    expect(readRecipeResumeOptions).not.toHaveBeenCalled();
  });
});
