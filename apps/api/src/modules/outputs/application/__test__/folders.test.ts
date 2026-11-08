import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import {
  OutputRepository,
  type OutputRecord,
} from "~/modules/outputs/infrastructure/OutputRepository";
import {
  SourceRepository,
  type SourceCollectionRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

import { addCollectionOutputs } from "../folders";

const folder: SourceCollectionRecord = {
  id: "folder-1",
  created_by_user_id: 42,
  project_id: null,
  title: "Discover episodes",
  description: null,
  kind: "general",
  feed_token_hash: null,
  settings: null,
  created_at: "2026-10-25T10:00:00.000Z",
  updated_at: null,
};

const output = {
  id: "output-1",
  created_by_user_id: 42,
  project_id: null,
  content: "{}",
} as OutputRecord;

function contextWith(collection: SourceCollectionRecord, record: OutputRecord) {
  const linkOutputs = vi.fn().mockResolvedValue(1);
  const context = {
    repositories: fakeRepositories([
      [SourceRepository, { getCollection: vi.fn().mockResolvedValue(collection) }],
      [OutputRepository, { getOutput: vi.fn().mockResolvedValue(record), linkOutputs }],
    ]),
  } as unknown as ServiceContext;

  return { context, linkOutputs };
}

describe("adding made items to a folder", () => {
  it("does not link someone else's item", async () => {
    const { context, linkOutputs } = contextWith(folder, { ...output, created_by_user_id: 7 });

    await expect(addCollectionOutputs(context, 42, folder.id, [output.id])).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(linkOutputs).not.toHaveBeenCalled();
  });
});
