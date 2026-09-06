import { ChatRunApi } from "../fixtures/chat-run-api";
import { expect, test } from "../fixtures/polychat-test";

test.describe("Authoritative run replay", () => {
  test.use({ persona: "pro" });

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
