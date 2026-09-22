import { strudelListPatternsResponseSchema } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.use({ persona: "pro" });

test("saves a conversation-generated playable pattern in Files with its origin", async ({
  homePage,
  page,
  polychatApi,
}) => {
  await homePage.navigate("/chat");
  await homePage.selectModel("GPT OSS 120B");
  const request = await homePage.sendMessageAndRequireCompletion(
    "Create a conversation for a release drum loop",
  );
  const conversationId = homePage.completionIdFromRequest(request);
  const generation = await page.request.post(`${E2E_API_BASE_URL}/chat/completions`, {
    headers: { origin: E2E_APP_BASE_URL },
    data: {
      ...request,
      command_id: crypto.randomUUID(),
      enabled_tools: ["generate_pattern"],
      messages: [{ role: "user", content: "Generate a playable release drum loop" }],
      stream: false,
    },
  });

  await requireSuccessfulResponse(generation, "Generate a release drum loop");
  const response = await page.request.get(`${E2E_API_BASE_URL}/apps/strudel`);

  await requireSuccessfulResponse(response, "Read generated patterns");
  const { patterns } = strudelListPatternsResponseSchema.parse(await response.json());
  const pattern = patterns.find((entry) => entry.name === "Release drum loop");

  expect(pattern).toBeDefined();
  if (!pattern) {
    throw new Error("The generated pattern was not saved");
  }

  expect(pattern.code).toBe('sound("bd sd bd sd")');
  expect(await polychatApi.getOutput(pattern.id)).toMatchObject({
    kind: "strudel_pattern",
    conversationId,
    projectId: null,
  });
  await homePage.navigate(`/chat/files/made/${pattern.id}`);
  await expect(page.getByRole("heading", { name: "Release drum loop", exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toContainText('sound("bd sd bd sd")');
});
