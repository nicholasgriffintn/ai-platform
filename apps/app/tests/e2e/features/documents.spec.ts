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
    await homePage.navigate(`/files/made/${written.id}`);

    const editor = page.getByRole("textbox", { name: "Document content" });

    await expect(editor).toHaveValue(/The first draft, as written\./);
    await editor.fill("# Launch week brief\n\nThe edited draft, as revised.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
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
});
