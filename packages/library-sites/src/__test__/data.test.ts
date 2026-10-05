import { describe, expect, it } from "vitest";

import { dataProject } from "../../test/fixtures/data-project.js";
import { loadGeneratedDataModule } from "../../test/fixtures/generated-module.js";
import { generateSiteFiles } from "../codegen/project.js";

describe("exported site data", () => {
  it("connects exported actions to authenticated, revision-bound API requests", async () => {
    const generated = generateSiteFiles(dataProject).files.find((file) =>
      file.path.endsWith("lib/site-data.ts"),
    );

    if (!generated) {
      throw new Error("Missing generated data transport");
    }

    const { createSiteDataTransport } = loadGeneratedDataModule(generated.content);
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
    let revision = 3;
    const changedDuringRequest = createSiteDataTransport({
      baseUrl: "https://api.example",
      siteId: "site",
      getRevision: () => revision,
      fetchAuthenticated: async () => {
        revision = 4;

        return Response.json({ revision: 3, bindings: { tasks: [{ title: "Stale" }] } });
      },
    });

    await expect(changedDuringRequest.read()).rejects.toThrow("could not be loaded");
    const failed = createSiteDataTransport({
      baseUrl: "https://api.example",
      siteId: "site",
      getRevision: () => 3,
      fetchAuthenticated: async () => Response.json({ error: "Conflict" }, { status: 409 }),
    });

    await expect(
      failed.perform({
        action: "createRecord",
        collectionId: "tasks",
        values: { title: "Review" },
      }),
    ).rejects.toThrow("Reload before continuing");
  });
});
