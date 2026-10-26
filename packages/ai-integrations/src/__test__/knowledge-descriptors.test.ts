import { describe, expect, it } from "vitest";

import { getKnowledgeConnectorDescriptor } from "../knowledge-descriptors.js";
import { buildDescriptorParameters, readConnectorKnowledgePage } from "../knowledge.js";

function descriptor(id: string) {
  const found = getKnowledgeConnectorDescriptor(id);

  if (!found) {
    throw new Error(`Missing descriptor ${id}`);
  }

  return found;
}

describe("connector knowledge descriptors", () => {
  it("drops optional placeholders that were left empty", () => {
    expect(
      buildDescriptorParameters(descriptor("google-drive-docs").list.parameters, {
        folder_id: " ",
      }),
    ).toEqual({
      q: "mimeType = 'application/vnd.google-apps.document' and trashed = false",
      pageSize: 50,
    });
  });

  it("reads Notion pages with titles from any title property and stops when nothing is left", () => {
    const page = readConnectorKnowledgePage(
      {
        data: {
          results: [
            {
              id: "page-1",
              url: "https://www.notion.so/page-1",
              last_edited_time: "2026-10-25T10:00:00.000Z",
              archived: false,
              properties: {
                Status: { select: { name: "Done" } },
                Name: { title: [{ plain_text: "Launch " }, { plain_text: "plan" }] },
              },
            },
            { id: "page-2", archived: true, properties: {} },
          ],
          next_cursor: "cursor-2",
          has_more: false,
        },
        successful: true,
      },
      descriptor("notion-database"),
      null,
    );

    expect(page.items).toEqual([
      expect.objectContaining({
        externalId: "page-1",
        title: "Launch plan",
        status: "available",
        revision: "2026-10-25T10:00:00.000Z",
        content: null,
      }),
      expect.objectContaining({ externalId: "page-2", title: null, status: "archived" }),
    ]);
    expect(page.next).toBeNull();
  });

  it("pages GitHub issues by number until a page comes back empty", () => {
    const github = descriptor("github-issues");
    const full = readConnectorKnowledgePage(
      { data: { issues: [{ number: 4, title: "Bug", body: "Steps", updated_at: "2026-10-01" }] } },
      github,
      2,
    );
    const empty = readConnectorKnowledgePage({ data: { issues: [] } }, github, 3);

    expect(full.items[0]).toMatchObject({ externalId: "4", content: "Steps" });
    expect(full.next).toEqual({ page: 3 });
    expect(empty.next).toBeNull();
  });
});
