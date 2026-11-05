import { ACCOUNT_EXPORT_NEXT_HEADER } from "@ngriffin_uk/polychat-schemas";
import { getTableName, isTable } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

const getObjectBody = vi.hoisted(() => vi.fn());

vi.mock("~/infrastructure/storage", () => ({
  StorageService: { forPrivateAssets: vi.fn(() => ({ getObjectBody })) },
}));

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import * as schema from "~/infrastructure/database/schema";
import {
  ACCOUNT_EXPORT_INCLUDED_TABLES,
  ACCOUNT_EXPORT_LEFT_OUT,
} from "~/modules/account/domain/export-coverage";
import {
  ACCOUNT_EXPORT_PAGE_SIZE,
  AccountExportRepository,
  type AccountExportFileRow,
  type AccountExportFileSection,
  type AccountExportRow,
  type AccountExportSection,
} from "~/modules/account/infrastructure/AccountExportRepository";
import type { User } from "~/types";

import { exportAccountData, exportAccountFiles } from "../exportAccountData";

const user = { id: 7, name: "Sam", email: "sam@example.com" } as User;

interface Fixture {
  sections?: Partial<Record<AccountExportSection, AccountExportRow[]>>;
  files?: Partial<Record<AccountExportFileSection, AccountExportFileRow[]>>;
  messages?: AccountExportRow[];
}

function createExportContext({ sections = {}, files = {}, messages }: Fixture) {
  const page = <Row extends { id?: unknown }>(rows: Row[], after: string) =>
    rows.filter((row) => String(row.id) > after).slice(0, ACCOUNT_EXPORT_PAGE_SIZE);
  const listSection = vi.fn(async (section: AccountExportSection, _userId: number, after: string) =>
    page(sections[section] ?? [], after),
  );
  const listFiles = vi.fn(
    async (section: AccountExportFileSection, _userId: number, after: string) =>
      page(files[section] ?? [], after),
  );
  const listMessages = vi.fn(async (ids: readonly string[], after: string) => {
    if (after) {
      return [];
    }

    return messages ?? ids.map((id) => ({ id: `m-${id}`, conversation_id: id }));
  });
  const context = {
    env: {},
    repositories: fakeRepositories([
      [AccountExportRepository, { listSection, listFiles, listMessages }],
    ]),
    waitUntil: () => undefined,
  } as unknown as ServiceContext;

  return { context, listSection, listFiles, listMessages };
}

async function readArchive(response: Response) {
  const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));

  return {
    entries,
    read: (path: string) => JSON.parse(strFromU8(entries[path])),
  };
}

function fileRow(id: string, byteSize: number | null = 5): AccountExportFileRow {
  return { id, storage_key: `private/${id}`, name: `${id}.bin`, byte_size: byteSize };
}

describe("exportAccountData", () => {
  it("includes stored files without exposing storage keys or path traversal", async () => {
    getObjectBody.mockImplementation(async (key: string) =>
      key === "private/one" ? { size: 5, body: new Blob(["bytes"]).stream() } : null,
    );

    const { context } = createExportContext({
      sections: {
        sources: [{ id: "s1", external_uri: "https://example.com/doc?token=abc123&page=2" }],
      },
      files: {
        sources: [{ id: "s1", storage_key: "private/one", name: "../../secret.txt", byte_size: 5 }],
        outputs: [fileRow("gone")],
      },
    });

    const { entries, read } = await readArchive(await exportAccountData(context, user));

    expect(strFromU8(entries["files/sources/s1/secret.txt"])).toBe("bytes");
    expect(JSON.stringify(read("data/sources.json"))).not.toContain("abc123");
    expect(JSON.stringify(read("manifest.json"))).not.toContain("private/");
    expect(read("manifest.json").files).toEqual({
      included: 1,
      omitted: [{ section: "outputs", resource_id: "gone", reason: "missing" }],
      next_after: null,
    });
  });

  it("pages through every row and exports messages for the person's conversations only", async () => {
    const conversations = Array.from({ length: ACCOUNT_EXPORT_PAGE_SIZE + 1 }, (_, index) => ({
      id: `c${String(index).padStart(4, "0")}`,
    }));
    const { context, listSection, listMessages } = createExportContext({
      sections: { conversations },
    });

    const { read } = await readArchive(await exportAccountData(context, user));

    expect(read("data/conversations.json")).toHaveLength(conversations.length);
    expect(listSection).toHaveBeenCalledWith(
      "conversations",
      user.id,
      conversations[ACCOUNT_EXPORT_PAGE_SIZE - 1].id,
    );
    expect(new Set(listMessages.mock.calls.flatMap(([ids]) => ids))).toEqual(
      new Set(conversations.map(({ id }) => id)),
    );
    expect(read("manifest.json").sections.messages).toEqual({
      file: "data/messages.json",
      count: conversations.length,
    });
  });

  it("keeps recipe secrets and connector tokens out of settings and tool traces", async () => {
    const { context } = createExportContext({
      sections: {
        conversations: [{ id: "c1" }],
        templates: [
          {
            id: "t1",
            configuration: JSON.stringify({
              channel: "#ops",
              webhookSecret: "whsec-value",
              nested: { accessToken: "oauth-value", maxTokens: 500 },
            }),
          },
        ],
        recipe_triggers: [
          { id: "r1", configuration: JSON.stringify({ apiKey: "key-value", label: "Daily" }) },
        ],
      },
      messages: [
        {
          id: "m1",
          conversation_id: "c1",
          role: "tool",
          content: 'result {"token": "tool-output-value"}',
          tool_call_arguments: JSON.stringify({ query: "weather", api_key: "argument-value" }),
        },
      ],
    });

    const { read } = await readArchive(await exportAccountData(context, user));
    const exported = JSON.stringify([
      read("data/templates.json"),
      read("data/recipe_triggers.json"),
      read("data/messages.json"),
    ]);

    for (const secret of [
      "whsec-value",
      "oauth-value",
      "key-value",
      "tool-output-value",
      "argument-value",
    ]) {
      expect(exported).not.toContain(secret);
    }

    expect(read("data/templates.json")[0].configuration).toEqual({
      channel: "#ops",
      nested: { maxTokens: 500 },
    });
    expect(read("data/messages.json")[0].tool_call_arguments).toEqual({ query: "weather" });
  });

  it("lets a large account retrieve every file across parts without gaps or repeats", async () => {
    getObjectBody.mockImplementation(async () => ({ size: 1, body: new Blob(["x"]).stream() }));

    const outputs = Array.from({ length: 900 }, (_, index) =>
      fileRow(`o${String(index).padStart(4, "0")}`, 1),
    );
    const { context } = createExportContext({ files: { outputs, pets: [fileRow("pet", null)] } });
    const collected: string[] = [];

    let response = await exportAccountData(context, user);

    while (true) {
      const after = response.headers.get(ACCOUNT_EXPORT_NEXT_HEADER);
      const { entries } = await readArchive(response);

      collected.push(...Object.keys(entries).filter((path) => path.startsWith("files/")));

      if (!after) {
        break;
      }

      response = await exportAccountFiles(context, user, after);
    }

    expect(collected).toHaveLength(outputs.length + 1);
    expect(new Set(collected).size).toBe(collected.length);
  });

  it("rejects a cursor that names no file section", async () => {
    const { context } = createExportContext({});

    await expect(exportAccountFiles(context, user, "user_credential:1")).rejects.toThrow(
      "Invalid export cursor",
    );
  });

  it("fails the download instead of delivering a partial archive", async () => {
    const { context, listSection } = createExportContext({});

    listSection.mockRejectedValue(new Error("database unavailable"));

    const response = await exportAccountData(context, user);

    await expect(response.arrayBuffer()).rejects.toThrow("database unavailable");
  });
});

describe("export coverage", () => {
  it("decides whether every table is exported or left out for a stated reason", () => {
    const tables = Object.values(schema).filter(isTable).map(getTableName);
    const decided = new Set<string>([
      ...ACCOUNT_EXPORT_INCLUDED_TABLES,
      ...ACCOUNT_EXPORT_LEFT_OUT.flatMap(({ tables: leftOut }) => leftOut),
    ]);

    expect(tables.filter((table) => !decided.has(table))).toEqual([]);
  });
});
