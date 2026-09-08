import { OutputApi } from "../fixtures/output-api";
import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { OutputRevisionPage } from "../page-objects/OutputRevisionPage";

test.describe("Output revision authority and restoration", () => {
  test.use({ persona: "pro" });

  test("compares earlier content and appends a restore without rewriting its origin", async ({
    page,
    polychatApi,
  }) => {
    const outputs = new OutputApi(page.request);
    const review = new OutputRevisionPage(page);
    const original = await outputs.create({
      capabilityId: "notes",
      kind: "note",
      status: "ready",
      title: "Restore the approved wording",
      content: { format: "markdown", body: "Original approved wording" },
      sensitivity: "confidential",
    });

    expect(await polychatApi.reviseOutputStatus(original.id, "Later wording", 1)).toBe(200);
    await review.navigate(`/chat/files/made/${original.id}`);
    await review.compare(1);
    await expect(review.history.getByLabel("Changed fields")).toContainText("content changed");
    await expect(review.history).toContainText("Original approved wording");
    await expect(review.history).toContainText("Later wording");
    await expect(review.history).toContainText("Origin of revision 1");
    await review.restore(1);
    await expect(review.history).toContainText("Current revision 3 · restored from revision 1");

    const history = await outputs.history(original.id);
    const restored = await polychatApi.getOutput(original.id);

    expect(history.current.restoredFromRevision).toBe(1);
    expect(history.revisions.map((revision) => revision.revision)).toEqual(
      expect.arrayContaining([1, 2]),
    );
    expect(restored.content).toEqual(original.content);
    expect(restored.provenance).toEqual(original.provenance);
    expect(restored.sensitivity).toBe(original.sensitivity);
    expect(restored.status).toBe(original.status);
  });

  test("rejects a stale restore and refreshes history without losing another writer's content", async ({
    page,
    polychatApi,
  }) => {
    const outputs = new OutputApi(page.request);
    const review = new OutputRevisionPage(page);
    const original = await outputs.create({
      capabilityId: "notes",
      kind: "note",
      status: "ready",
      title: "Concurrent restore",
      content: { body: "First version" },
    });

    expect(await polychatApi.reviseOutputStatus(original.id, "Second version", 1)).toBe(200);
    await review.navigate(`/chat/files/made/${original.id}`);
    await review.compare(1);
    expect(await polychatApi.reviseOutputStatus(original.id, "Other writer's version", 2)).toBe(
      200,
    );
    await review.restore(1);
    await expect(review.history.getByRole("alert")).toContainText(/changed/i);
    await expect(review.history).toContainText("Current revision 3");
    expect((await polychatApi.getOutput(original.id)).content).toMatchObject({
      body: "Other writer's version",
    });
    expect((await outputs.history(original.id)).current.operation).toBe("updated");
  });

  test("refuses another account's history and leaves external output history review-only", async ({
    browser,
    page,
    polychatApi,
  }) => {
    const outputs = new OutputApi(page.request);
    const review = new OutputRevisionPage(page);
    const original = await outputs.create({
      capabilityId: "sandbox",
      kind: "sandbox_artifact",
      status: "ready",
      title: "External repository result",
      content: { body: "First diff" },
    });

    expect(await polychatApi.reviseOutputStatus(original.id, "Second diff", 1)).toBe(200);
    await review.navigate(`/chat/files/made/${original.id}`);
    await review.compare(1);
    await expect(review.restoreAction(1)).toBeDisabled();
    await expect(review.history).toContainText(/cannot reverse repository work/);
    expect(await outputs.restoreStatus(original.id, 1, 2)).toBe(409);
    const outsider = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:outsider`,
    );

    try {
      const outsiderOutputs = new OutputApi(outsider.context.request);

      expect(await outsiderOutputs.historyStatus(original.id)).toBe(404);
      expect(await outsiderOutputs.restoreStatus(original.id, 1, 2)).toBe(404);
    } finally {
      await outsider.context.close();
    }
  });
});
