import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("Document search reranking", () => {
  test.use({ persona: "pro" });

  test("reranks only the owner's retrieved passages before applying the result limit", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    const endpoint = `${E2E_API_BASE_URL}/apps/embeddings/insert`;
    const headers = { origin: E2E_APP_BASE_URL };

    for (const [id, title] of [
      ["canary-first", "First canary note"],
      ["canary-second", "Second canary note"],
    ]) {
      const response = await page.request.post(endpoint, {
        headers,
        data: {
          id,
          type: "note",
          title,
          content: `${title}: release checklist and canary status.`,
        },
      });

      await requireSuccessfulResponse(response, `Store ${title}`);
    }

    const teammate = await polychatApi.createToolTeammate("Canary document search", [
      "search_documents",
    ]);

    await homePage.navigate(`/chat?teammate=${teammate.id}`);
    await homePage.sendMessage("Search my release documents for canary");
    const passages = page
      .getByText("2 passages for “canary release”")
      .locator("..")
      .getByRole("listitem");

    await expect(passages).toHaveCount(2);
    await expect(passages.nth(0)).toContainText("Second canary note");
    await expect(passages.nth(1)).toContainText("First canary note");
    await expect(passages.nth(0)).toContainText("model-ranked");
  });
});
