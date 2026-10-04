import { describe, expect, it } from "vitest";

import { dataProject } from "../../test/fixtures/data-project.js";
import { loadGeneratedDataModule } from "../../test/fixtures/generated-module.js";
import { renderSiteDataModule } from "../codegen/data.js";
import {
  normaliseSiteIntegrations,
  normaliseSiteSourceRows,
  projectSiteSourceRows,
  validateSiteCollectionValues,
} from "../data.js";
import { buildSiteFrameDocument } from "../preview-document.js";
import { getStatePath, runSiteAction, setStatePath } from "../state.js";

describe("scoped site data", () => {
  it("connects exported actions to authenticated, revision-bound API requests", async () => {
    const { createSiteDataTransport } = loadGeneratedDataModule(renderSiteDataModule());
    const requests: { url: string; init: RequestInit }[] = [];
    const transport = createSiteDataTransport({
      baseUrl: "https://api.example/v1",
      siteId: "site/id",
      projectId: "project",
      getRevision: () => 3,
      fetchAuthenticated: async (url, init) => {
        requests.push({ url, init });

        return Response.json({ data: { revision: 3, bindings: { tasks: [{ title: "Review" }] } } });
      },
    });

    expect(await transport.read()).toEqual({ tasks: [{ title: "Review" }] });
    await transport.perform({ action: "refreshData" });
    expect(requests[0].url).toBe("https://api.example/v1/sites/site%2Fid/data/read");
    expect(JSON.parse(String(requests[1].init.body))).toEqual({
      projectId: "project",
      expectedRevision: 3,
      operation: { action: "refreshData" },
    });
    const stale = createSiteDataTransport({
      baseUrl: "https://api.example",
      siteId: "site",
      getRevision: () => 3,
      fetchAuthenticated: async () => Response.json({ revision: 4, bindings: {} }),
    });

    await expect(stale.read()).rejects.toThrow("could not be loaded");
  });
  it("keeps valid collections and rejects missing or overlapping bindings", () => {
    const parsed = normaliseSiteIntegrations(
      {
        ...dataProject,
        dataBindings: {
          ...dataProject.dataBindings,
          nested: {
            kind: "collection",
            collectionId: "tasks",
            pageId: "home",
            statePath: "/tasks/nested",
          },
          missing: {
            kind: "collection",
            collectionId: "missing",
            pageId: "home",
            statePath: "/missing",
          },
        },
      },
      dataProject,
    );

    expect(Object.keys(parsed.dataBindings ?? {})).toEqual(["tasks"]);
    expect(parsed.issues).toHaveLength(2);
  });

  it("emits remote actions without modifying local records and reports invalid requests", () => {
    const state = { tasks: [] };
    const result = runSiteAction(
      { action: "createRecord", params: { collectionId: "tasks", values: { $form: true } } },
      { state, form: { title: "Review" } },
    );

    expect(result.state).toBe(state);
    expect(result.effect).toEqual({
      action: "createRecord",
      collectionId: "tasks",
      values: { title: "Review" },
    });
    expect(
      runSiteAction({ action: "updateRecord", params: { collectionId: "tasks" } }, { state }).error,
    ).toBeTruthy();
  });

  it("validates required values and rejects unknown fields", () => {
    const collection = dataProject.collections!.tasks;

    expect(validateSiteCollectionValues(collection, { title: "Review", done: false })).toBeNull();
    expect(validateSiteCollectionValues(collection, { title: " " })).toContain("Required");
    expect(validateSiteCollectionValues(collection, { title: "Review", done: "yes" })).toContain(
      "boolean",
    );
    expect(validateSiteCollectionValues(collection, { title: "Review", injected: true })).toContain(
      "Unknown",
    );
  });

  it("projects only chosen connector fields and bounds the snapshot", () => {
    expect(
      projectSiteSourceRows(
        { results: [{ name: "Review", nested: { count: 2 }, secret: "exclude" }] },
        "/results",
        { title: "/name", count: "/nested/count" },
      ),
    ).toEqual([{ title: "Review", count: 2 }]);
    expect(() =>
      normaliseSiteSourceRows(Array.from({ length: 501 }, () => ({ title: "task" }))),
    ).toThrow();
    expect(() => normaliseSiteSourceRows([{ data: { nested: true } }])).toThrow();
  });

  it("prevents data from escaping the preview document and rejects prototype paths", () => {
    const document = buildSiteFrameDocument({
      frameId: "frame",
      title: "Tasks",
      fontUrl: "https://fonts.example",
      runtimeUrl: "/runtime.js",
      stylesheetUrl: "/styles.css",
      initialProject: dataProject,
      initialData: { tasks: [{ title: "</script><script>alert(1)</script>" }] },
    });

    expect(document).not.toContain("</script><script>alert");
    expect(() => setStatePath({}, "/__proto__/polluted", true)).toThrow("Unsafe");
    expect(getStatePath({}, "/toString")).toBeUndefined();
  });
});
