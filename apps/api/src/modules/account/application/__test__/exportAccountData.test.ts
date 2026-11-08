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

import { exportAccountData } from "../exportAccountData";

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
