import { documentExportFilename } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";

test.describe("Documents as finished work", () => {
  test.use({ persona: "pro" });

  test("opens a document a teammate wrote, edits it, and exports the saved version", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    const title = "Launch week brief";
    const written = await polychatApi.writeDocumentOutput(
      title,
      "# Launch week brief\n\nThe first draft, as written.",
    );

    expect(written.revision).toBe(1);
    await homePage.navigate(`/chat/files/made/${written.id}`);

    const editor = page.getByRole("textbox", { name: "Document content" });

    await expect(editor).toHaveValue(/The first draft, as written\./);
    await editor.fill("# Launch week brief\n\nThe edited draft, as revised.");
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname.endsWith(`/outputs/${written.id}`),
    );

    await page.getByRole("button", { name: "Save", exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();

    const revised = await polychatApi.getOutput(written.id);

    expect(revised.revision).toBe(2);
    expect(revised.content).toEqual({
      format: "markdown",
      body: "# Launch week brief\n\nThe edited draft, as revised.",
    });

    const exported = await polychatApi.exportOutputDocument(written.id);

    expect(exported.status).toBe(200);
    expect(exported.contentType).toContain("text/markdown");
    expect(exported.contentDisposition).toContain(documentExportFilename(title));
    expect(exported.body).toBe("# Launch week brief\n\nThe edited draft, as revised.");
  });

  test("refuses a stale revision, keeps one document, and exports only documents", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    const title = "Verification digest";
    const written = await polychatApi.writeDocumentOutput(
      title,
      "# Verification digest\n\nThe original digest.",
    );

    await homePage.navigate(`/chat/files/made/${written.id}`);

    const editor = page.getByRole("textbox", { name: "Document content" });

    await expect(editor).toHaveValue(/The original digest\./);

    expect(
      await polychatApi.reviseOutputStatus(
        written.id,
        "# Verification digest\n\nRevised somewhere else.",
        written.revision,
      ),
    ).toBe(200);

    const elsewhere = await polychatApi.getOutput(written.id);

    expect(elsewhere.revision).toBe(2);

    await editor.fill("# Verification digest\n\nRevised in the editor.");
    const refused = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname.endsWith(`/outputs/${written.id}`),
    );

    await page.getByRole("button", { name: "Save", exact: true }).click();
    expect((await refused).status()).toBe(409);
    await expect(page.getByRole("alert")).toContainText(/changed/i);

    const unchanged = await polychatApi.getOutput(written.id);

    expect(unchanged.revision).toBe(2);
    expect(unchanged.content).toEqual({
      format: "markdown",
      body: "# Verification digest\n\nRevised somewhere else.",
    });

    await expect(page.getByRole("region", { name: "Revision history" })).toBeVisible();

    const image = await polychatApi.writeImageOutput("Release chart");
    const refusedExport = await polychatApi.exportOutputDocument(image.id);

    expect(refusedExport.status).toBe(400);
    expect(refusedExport.body).toContain("not a document");

    await homePage.navigate(`/chat/files/made/${image.id}`);
    await expect(page.getByRole("textbox", { name: "Document content" })).toHaveCount(0);
  });
});
