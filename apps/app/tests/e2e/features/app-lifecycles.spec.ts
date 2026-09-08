import { capabilityCatalogResponseSchema } from "@ngriffin_uk/polychat-schemas";

import { OutputApi } from "../fixtures/output-api";
import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL } from "../support/environment";

test.describe("Apps retain their runtime and scope", () => {
  test.use({ persona: "pro" });

  test("opens every personal app from its library and gates apps in a project", async ({
    page,
    capabilitiesPage,
    workPage,
  }) => {
    const response = await page.request.get(`${E2E_API_BASE_URL}/capabilities`);

    await requireSuccessfulResponse(response, "Read app catalogue");
    const catalog = capabilityCatalogResponseSchema.parse(await response.json());

    for (const app of catalog.experiences) {
      await capabilitiesPage.open();
      await capabilitiesPage
        .capabilityCard(app.name)
        .getByRole("button", { name: "Open", exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/chat/apps/${app.id}$`));
      if (app.runtime === "notes") {
        await expect(page.getByRole("link", { name: "New note", exact: true })).toBeVisible();
      }

      if (app.runtime === "articles") {
        await expect(page.getByRole("link", { name: "New report", exact: true })).toBeVisible();
      }

      if (app.runtime === "recordings") {
        await expect(page.getByRole("link", { name: "New recording", exact: true })).toBeVisible();
      }

      if (app.runtime === "strudel") {
        await expect(page.getByRole("link", { name: "New pattern", exact: true })).toBeVisible();
      }

      if (app.runtime === "image-studio") {
        await expect(page.getByPlaceholder("Describe what to generate...")).toBeVisible();
      }

      if (app.runtime === "replicate") {
        await expect(page.getByPlaceholder("Search Replicate models...")).toBeVisible();
      }

      if (app.runtime === "finetuning") {
        await expect(page.getByRole("tab", { name: "Jobs", exact: true })).toBeVisible();
      }

      await page.getByRole("link", { name: "Back to teammates", exact: true }).click();
      await expect(page).toHaveURL(/\/chat\/teammates$/);
    }

    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const workspaceId = workPage.currentWorkspaceId();
    const projectId = workPage.currentProjectId();

    for (const app of catalog.experiences.filter((app) => app.scope !== "personal")) {
      await workPage.navigate(`/work/${workspaceId}/projects/${projectId}/apps/${app.id}`);
      await expect(
        page.getByRole("heading", { name: "App not enabled", exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Open teammates", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/teammates$`));
    }

    await capabilitiesPage.navigate("/chat/apps/does-not-exist");
    await expect(page.getByRole("heading", { name: "App not found", exact: true })).toBeVisible();
  });

  test("automatically saves a note and preserves later edits across reopening", async ({
    page,
    capabilitiesPage,
  }) => {
    await capabilitiesPage.navigate("/chat/apps/notes/new");
    const editor = page.getByPlaceholder("Start typing...");

    await editor.fill("Release note\nOriginal evidence survives reopening.");
    await expect(page).toHaveURL(/\/chat\/apps\/notes\/(?!new$)[^/]+$/);
    const notePath = new URL(page.url()).pathname;

    await capabilitiesPage.reload();
    await expect(editor).toHaveValue("Release note\nOriginal evidence survives reopening.");
    const updated = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname.includes("/notes/"),
    );

    await editor.fill("Release note\nRevised evidence also survives reopening.");
    expect((await updated).status()).toBe(200);
    await capabilitiesPage.open();
    await capabilitiesPage.navigate(notePath);
    await expect(editor).toHaveValue("Release note\nRevised evidence also survives reopening.");
  });
  test("reads capture metadata stored by older notes", async ({ page, capabilitiesPage }) => {
    const note = await new OutputApi(page.request).create({
      capabilityId: "notes",
      kind: "note",
      status: "ready",
      title: "Captured release evidence",
      content: {
        title: "Captured release evidence",
        content: "A retained note",
        metadata: {
          tabSource: { title: "Original release source", url: "https://example.test/release" },
        },
      },
    });

    await capabilitiesPage.navigate(`/chat/apps/notes/${note.id}`);
    await expect(page.getByPlaceholder("Start typing...")).toHaveValue(
      "Captured release evidence\nA retained note",
    );
    await page.getByRole("button", { name: /Metadata/ }).click();
    await expect(page.getByText("Original release source", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "https://example.test/release", exact: true }),
    ).toHaveAttribute("href", "https://example.test/release");
  });
});
