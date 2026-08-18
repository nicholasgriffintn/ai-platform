import { describe, expect, it } from "vitest";

import { getPrivateFileAccessScope, getPrivateFileResponse } from "./read-resource";

const personalFile = {
  created_by_user_id: 12,
  project_id: null,
  conversation_id: null,
  storage_key: "private/file",
  mime_type: "text/plain",
  filename: "notes.txt",
};

describe("private file access", () => {
  it("requires current project membership even for the project file creator", () => {
    expect(
      getPrivateFileAccessScope(
        { ...personalFile, project_id: "project-1", created_by_user_id: 12 },
        12,
      ),
    ).toBe("project");
  });

  it("allows the owner to read a personal file", () => {
    expect(getPrivateFileAccessScope(personalFile, 12)).toBe("owner");
  });

  it("only considers conversation visibility for personal conversation files", () => {
    expect(
      getPrivateFileAccessScope({ ...personalFile, conversation_id: "conversation-1" }, 99),
    ).toBe("public-conversation");
    expect(
      getPrivateFileAccessScope({
        ...personalFile,
        project_id: "project-1",
        conversation_id: "conversation-1",
      }),
    ).toBe("denied");
  });
});

describe("private file responses", () => {
  it("downloads active content instead of rendering it in the API origin", async () => {
    const response = await getPrivateFileResponse(
      { ...personalFile, mime_type: "text/html", filename: "page.html" },
      { arrayBuffer: async () => new ArrayBuffer(0) },
    );

    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="page.html"');
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("renders passive media inline", async () => {
    const response = await getPrivateFileResponse(
      { ...personalFile, mime_type: "image/png", filename: "image.png" },
      { arrayBuffer: async () => new ArrayBuffer(0) },
    );

    expect(response.headers.get("Content-Disposition")).toBe('inline; filename="image.png"');
  });
});
