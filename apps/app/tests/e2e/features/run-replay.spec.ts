import {
  chatRunCommandReceiptSchema,
  parseChatStreamSseBuffer,
} from "@ngriffin_uk/polychat-schemas";

import { ChatRunApi } from "../fixtures/chat-run-api";
import { expect, test } from "../fixtures/polychat-test";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("Authoritative run replay", () => {
  test.use({ persona: "pro" });

  test("keeps one run through a tool turn and refuses duplicate or conflicting command work", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    const completion = await homePage.sendMessageAndReadCompletionStream("List my saved messages");

    expect(completion.status).toBe(200);
    const receipts = parseChatStreamSseBuffer(completion.body, { flush: true })
      .events.filter((event) => "state" in event && event.state === "run")
      .map((event) =>
        chatRunCommandReceiptSchema.parse("receipt" in event ? event.receipt : undefined),
      );

    expect(receipts.length).toBeGreaterThanOrEqual(2);
    const first = receipts[0];

    expect(first.run.status).toBe("running");
    expect(receipts.at(-1)?.run.status).toBe("succeeded");
    expect(new Set(receipts.map((receipt) => receipt.run.id))).toEqual(new Set([first.run.id]));
    const conversationId = homePage.completionIdFromRequest(completion.request);
    const before = await polychatApi.getConversation(conversationId);

    expect(before.latest_run?.id).toBe(first.run.id);
    const duplicate = await page.request.post(`${E2E_API_BASE_URL}/chat/completions`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: completion.request,
    });

    expect(duplicate.status()).toBe(200);
    const repeated = parseChatStreamSseBuffer(await duplicate.text(), { flush: true }).events.find(
      (event) => "state" in event && event.state === "run",
    );
    const receipt = chatRunCommandReceiptSchema.parse(
      repeated && "receipt" in repeated ? repeated.receipt : undefined,
    );

    expect(receipt.duplicate).toBe(true);
    expect(receipt.run.id).toBe(first.run.id);
    const conflict = await page.request.post(`${E2E_API_BASE_URL}/chat/completions`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: {
        ...completion.request,
        messages: [{ role: "user", content: "Different command input" }],
      },
    });

    expect(conflict.status()).toBe(409);
    const after = await polychatApi.getConversation(conversationId);

    expect(after.messages).toEqual(before.messages);
    expect(after.latest_run).toMatchObject({ id: first.run.id, status: "succeeded", attempt: 1 });
    await homePage.reload();
    expect((await polychatApi.getConversation(conversationId)).latest_run?.id).toBe(first.run.id);
  });

  test("replays later events with stable ordered identities and resets a cursor ahead of the server", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    const runs = new ChatRunApi(page.request);

    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    const request = await homePage.sendMessageAndRequireCompletion(
      "Recover this interrupted stream to verify ordered replay",
    );
    const conversationId = homePage.completionIdFromRequest(request);
    const run = (await polychatApi.getConversation(conversationId)).latest_run;

    if (!run) {
      throw new Error("Expected an accepted stored run");
    }

    const initial = await runs.snapshot(run.id);

    expect(initial.cursor).toBeGreaterThanOrEqual(0);
    await expect(homePage.stopResponseButton).toBeHidden({ timeout: 10_000 });
    const final = await runs.snapshot(run.id);
    const replay = await runs.events(run.id, initial.cursor);

    expect(final.run.status).toBe("succeeded");
    expect(replay.resetRequired).toBe(false);
    expect(replay.events.length).toBeGreaterThan(0);
    expect(replay.nextCursor).toBe(final.cursor);
    const sequences = replay.events.map((event) => event.sequence);

    expect(sequences).toEqual([...new Set(sequences)].sort((left, right) => left - right));
    expect(sequences.every((sequence) => sequence > initial.cursor)).toBe(true);
    expect(new Set(replay.events.map((event) => event.id)).size).toBe(replay.events.length);
    expect(await runs.events(run.id, initial.cursor)).toEqual(replay);
    const reset = await runs.events(run.id, final.cursor + 100);

    expect(reset.resetRequired).toBe(true);
    expect(reset.events).toEqual([]);
    expect(reset.snapshot).toEqual(final);
  });
});
