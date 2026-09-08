import {
  authoredSkillHistoryResponseSchema,
  authoredSkillVersionedDocumentSchema,
} from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("Skill tools preserve reviewed instructions", () => {
  test.use({ persona: "pro" });

  test("saves an agreed skill, proposes without changing stable instructions, promotes and loads the correction", async ({
    homePage,
    page,
    capabilitiesPage,
  }) => {
    const url = `${E2E_API_BASE_URL}/skills/documents/release-playbook`;
    const headers = { origin: E2E_APP_BASE_URL };

    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion("Save the agreed release skill");
    await expect(homePage.getLatestAssistantMessage()).toContainText("Saved release-playbook");
    const initialResponse = await page.request.get(`${url}/history`);

    await requireSuccessfulResponse(initialResponse, "Read saved skill");
    const initial = authoredSkillHistoryResponseSchema.parse(await initialResponse.json());

    await homePage.sendMessageAndRequireCompletion("Propose the corrected release skill");
    await expect(homePage.getLatestAssistantMessage()).toContainText("draft until you accept");
    const draftResponse = await page.request.get(`${url}/history`);

    await requireSuccessfulResponse(draftResponse, "Read proposed skill");
    const draft = authoredSkillHistoryResponseSchema.parse(await draftResponse.json());

    expect(draft.state.stableRevisionId).toBe(initial.state.stableRevisionId);
    expect(draft.state.draftRevisionId).not.toBe(initial.state.draftRevisionId);
    const promotedResponse = await page.request.post(`${url}/promote`, {
      headers,
      data: {
        revisionId: draft.state.draftRevisionId,
        expectedStateVersion: draft.state.stateVersion,
      },
    });

    await requireSuccessfulResponse(promotedResponse, "Accept corrected skill");
    const promoted = authoredSkillVersionedDocumentSchema.parse(await promotedResponse.json());

    expect(promoted.content).toContain("Return the corrected release procedure.");
    expect(promoted.state.stableRevisionId).toBe(draft.state.draftRevisionId);
    await capabilitiesPage.open();
    await expect(capabilitiesPage.capabilityCard("release-playbook")).toBeVisible();
    await homePage.navigate("/chat");
    await homePage.sendMessageAndRequireCompletion("Load the accepted release skill");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Return the corrected release procedure.",
    );
    await homePage.sendMessageAndRequireCompletion("Propose a nonexistent release skill");
    expect(
      (
        await page.request.get(`${E2E_API_BASE_URL}/skills/documents/nonexistent-release-playbook`)
      ).status(),
    ).toBe(404);
    await expect(homePage.getLatestAssistantMessage()).toContainText(/not found|does not exist/i);
    await homePage.sendMessageAndRequireCompletion("Save a conflicting built-in release skill");
    await expect(homePage.getLatestAssistantMessage()).toContainText(/hacker-news/);
    expect(
      (await page.request.get(`${E2E_API_BASE_URL}/skills/documents/hacker-news`)).status(),
    ).toBe(404);
  });
});
