import { decisionResponseSchema } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("Decision API", () => {
  test.use({ persona: "pro" });

  test("answers independent typed questions and rejects an invalid question before provider use", async ({
    page,
  }) => {
    const endpoint = `${E2E_API_BASE_URL}/decisions`;
    const headers = { origin: E2E_APP_BASE_URL };
    const response = await page.request.post(endpoint, {
      headers,
      data: {
        state: { message: "Please review the release" },
        questions: {
          needs_review: { type: "noul", instructions: "Does the message request a review?" },
          destination: {
            type: "choice",
            instructions: "Which queue owns the request?",
            criteria: { release: "Release team", support: "Support team" },
          },
          urgency: {
            type: "score",
            instructions: "How urgent is the request?",
            criteria: ["routine", "urgent"],
          },
        },
      },
    });

    await requireSuccessfulResponse(response, "Judge release request");
    const decision = decisionResponseSchema.parse(await response.json());

    expect(decision.provider).toBe("typesafe");
    expect(Object.keys(decision.answers)).toEqual(["needs_review", "destination", "urgency"]);
    expect(decision.answers.needs_review).toMatchObject({ type: "noul", noul: 0.05 });
    expect(decision.answers.destination).toMatchObject({ type: "choice", choice: "release" });
    expect(decision.answers.urgency).toMatchObject({ type: "score", score: 0 });
    expect(decision.usage).toEqual({ input_tokens: 16, output_tokens: 8 });

    const invalid = await page.request.post(endpoint, {
      headers,
      data: {
        state: "release",
        questions: {
          destination: { type: "choice", instructions: "Choose", criteria: { only: "One choice" } },
        },
      },
    });

    expect(invalid.status()).toBe(400);
  });
});
