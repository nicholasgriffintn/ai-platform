import { authoredSkillHistoryResponseSchema } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL } from "../support/environment";

test.describe("Skill tools preserve reviewed instructions", () => {
  test.use({ persona: "pro" });

  test("asks before a tool call that contradicts the user's request and leaves no skill behind", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    const teammate = await polychatApi.createToolTeammate("Skill intent check", ["save_skill"]);

    await homePage.navigate(`/chat?teammate=${teammate.id}`);
    await homePage.sendMessage(
      "Do not save any skill. Save the agreed release skill is only the example to discuss.",
    );

    await expect(page.getByRole("region", { name: "Approval required" })).toContainText(
      "The proposed action does not clearly follow from the request",
    );
    expect(
      (await page.request.get(`${E2E_API_BASE_URL}/skills/documents/release-playbook`)).status(),
    ).toBe(404);
  });

  test("saves an agreed skill and keeps a proposed correction out of the loaded version", async ({
    homePage,
    page,
    capabilitiesPage,
    polychatApi,
  }) => {
    const url = `${E2E_API_BASE_URL}/skills/documents/release-playbook`;
    const teammate = await polychatApi.createToolTeammate("Skill revision check", [
      "save_skill",
      "propose_skill_revision",
      "load_skill",
    ]);

    await homePage.navigate(`/chat?teammate=${teammate.id}`);
    await homePage.sendMessage("Save the agreed release skill");
    await expect(homePage.getLatestAssistantMessage()).toContainText("Saved release-playbook");
    const initialResponse = await page.request.get(`${url}/history`);

    await requireSuccessfulResponse(initialResponse, "Read saved skill");
    const initial = authoredSkillHistoryResponseSchema.parse(await initialResponse.json());

    await homePage.sendMessage("Propose the corrected release skill");
    await expect(homePage.getLatestAssistantMessage()).toContainText("draft until you accept");
    const draftResponse = await page.request.get(`${url}/history`);

    await requireSuccessfulResponse(draftResponse, "Read proposed skill");
    const draft = authoredSkillHistoryResponseSchema.parse(await draftResponse.json());

    expect(draft.state.stableRevisionId).toBe(initial.state.stableRevisionId);
    expect(draft.state.draftRevisionId).not.toBe(initial.state.draftRevisionId);

    await capabilitiesPage.openPlugins();
    await expect(capabilitiesPage.capabilityCard("release-playbook")).toBeVisible();
    await capabilitiesPage.openSkillEditorFromLibrary("release-playbook");
    await expect(page.getByLabel("Skill document")).toHaveValue(
      /Return the corrected release procedure/,
    );
    await homePage.navigate(`/chat?teammate=${teammate.id}`);
    await homePage.sendMessage("Load the accepted release skill");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Return the original release procedure.",
    );
    await homePage.sendMessage("Propose a nonexistent release skill");
    expect(
      (
        await page.request.get(`${E2E_API_BASE_URL}/skills/documents/nonexistent-release-playbook`)
      ).status(),
    ).toBe(404);
    await expect(homePage.getLatestAssistantMessage()).toContainText(/not found|does not exist/i);
    await homePage.sendMessage("Save a conflicting built-in release skill");
    await expect(homePage.getLatestAssistantMessage()).toContainText(/hacker-news/);
    expect(
      (await page.request.get(`${E2E_API_BASE_URL}/skills/documents/hacker-news`)).status(),
    ).toBe(404);
  });
});
