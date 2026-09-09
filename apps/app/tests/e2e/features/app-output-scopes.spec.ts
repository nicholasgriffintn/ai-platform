import { outputSchema } from "@ngriffin_uk/polychat-schemas";

import { OutputApi } from "../fixtures/output-api";
import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("App output scope", () => {
  test.use({ persona: "pro" });

  test("isolates app histories and enforces project membership and enablement", async ({
    browser,
    page,
    workPage,
    polychatApi,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectId = workPage.currentProjectId();
    const outsider = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:outsider`,
    );
    const outputs = new OutputApi(page.request);

    try {
      for (const app of [
        { capability: "featured-note-taker", store: "notes", kind: "note", route: "notes" },
        {
          capability: "featured-article-processor",
          store: "articles",
          kind: "report",
          route: "articles",
        },
        {
          capability: "featured-recording-processor",
          store: "recordings",
          kind: "upload",
          route: "recordings",
        },
        {
          capability: "featured-strudel",
          store: "strudel",
          kind: "strudel_pattern",
          route: "strudel",
        },
        {
          capability: "featured-replicate",
          store: "replicate",
          kind: "prediction",
          route: "replicate/predictions",
        },
        {
          capability: "featured-image-studio",
          store: "canvas",
          kind: "generation",
          route: "canvas/generations",
        },
        {
          capability: "featured-image-studio",
          store: "drawings",
          kind: "drawing",
          route: "drawing",
        },
      ]) {
        await test.step(app.store, async () => {
          const url = `${E2E_API_BASE_URL}/apps/${app.route}`;
          const scopedUrl = `${url}?projectId=${projectId}`;

          if (app.store !== "drawings") {
            expect((await page.request.get(scopedUrl)).status()).toBe(404);
            expect(
              (await polychatApi.addProjectCapability(projectId, "app", app.capability)).status,
            ).toBe(200);
          }

          const personal = await outputs.create({
            capabilityId: app.store,
            kind: app.kind,
            status: "ready",
            groupId: `personal-${app.store}-${projectId}`,
            title: `Personal ${app.store} evidence`,
            content: {
              title: "Personal evidence",
              name: "Personal evidence",
              content: "Personal body",
              code: 'sound("bd")',
              mode: "image",
              status: "completed",
            },
          });
          const project = await outputs.create({
            projectId,
            capabilityId: app.store,
            kind: app.kind,
            status: "ready",
            groupId: `project-${app.store}-${projectId}`,
            title: `Project ${app.store} evidence`,
            content: {
              title: "Project evidence",
              name: "Project evidence",
              content: "Project body",
              code: 'sound("sd")',
              mode: "image",
              status: "completed",
            },
          });
          const personalResponse = await page.request.get(url);
          const projectResponse = await page.request.get(scopedUrl);

          await requireSuccessfulResponse(personalResponse, `Read personal ${app.store}`);
          await requireSuccessfulResponse(projectResponse, `Read project ${app.store}`);
          const personalBody = await personalResponse.text();
          const projectBody = await projectResponse.text();
          const personalId = ["notes", "strudel", "canvas", "drawings"].includes(app.store)
            ? personal.id
            : personal.groupId;
          const projectOutputId = ["notes", "strudel", "canvas", "drawings"].includes(app.store)
            ? project.id
            : project.groupId;

          expect(personalBody).toContain(personalId);
          expect(personalBody).not.toContain(projectOutputId);
          expect(projectBody).toContain(projectOutputId);
          expect(projectBody).not.toContain(personalId);
          expect((await outsider.context.request.get(scopedUrl)).status()).toBe(404);
          if (app.store === "canvas" || app.store === "drawings") {
            expect((await page.request.get(`${url}/${project.id}`)).status()).toBe(404);
            expect(
              (await page.request.get(`${url}/${project.id}?projectId=${projectId}`)).status(),
            ).toBe(200);
            expect(
              (await page.request.get(`${url}/${personal.id}?projectId=${projectId}`)).status(),
            ).toBe(404);
          }
        });
      }
    } finally {
      await outsider.context.close();
    }
  });
  test("keeps generated drawings and their source files in the project without overwriting earlier uploads", async ({
    page,
    workPage,
    polychatApi,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectId = workPage.currentProjectId();

    expect(
      (await polychatApi.addProjectCapability(projectId, "app", "featured-image-studio")).status,
    ).toBe(200);
    const keys = new Set<string>();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await page.request.post(
        `${E2E_API_BASE_URL}/apps/drawing?projectId=${projectId}`,
        {
          headers: { origin: E2E_APP_BASE_URL },
          multipart: {
            drawingId: "retained-drawing-group",
            drawing: {
              name: "drawing.png",
              mimeType: "image/png",
              buffer: Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                "base64",
              ),
            },
          },
        },
      );

      await requireSuccessfulResponse(response, "Generate project drawing");
      const result: { output_id: string } = await response.json();
      const detail = await page.request.get(`${E2E_API_BASE_URL}/outputs/${result.output_id}`);

      await requireSuccessfulResponse(detail, "Read generated drawing output");
      const output = outputSchema.parse(await detail.json());

      expect(output.projectId).toBe(projectId);
      expect(typeof output.content.drawingKey).toBe("string");
      if (typeof output.content.drawingKey !== "string") {
        throw new Error("Drawing key missing");
      }

      expect(keys.has(output.content.drawingKey)).toBe(false);
      keys.add(output.content.drawingKey);
      expect(output.content.drawingKey).not.toContain("retained-drawing-group");
      const source = await page.request.get(
        `${E2E_API_BASE_URL}/sources/${output.content.drawingSourceId}`,
      );

      await requireSuccessfulResponse(source, "Read original drawing source");
      expect(await source.json()).toMatchObject({ projectId });
      const personal = await page.request.get(`${E2E_API_BASE_URL}/apps/drawing`);

      expect(await personal.text()).not.toContain(output.id);
      const project = await page.request.get(
        `${E2E_API_BASE_URL}/apps/drawing?projectId=${projectId}`,
      );

      expect(await project.text()).toContain(output.id);
    }
  });
});
