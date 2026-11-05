import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

const getObjectBody = vi.hoisted(() => vi.fn());

vi.mock("~/infrastructure/storage", () => ({
  StorageService: { forPrivateAssets: vi.fn(() => ({ getObjectBody })) },
}));

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import {
  ACCOUNT_EXPORT_PAGE_SIZE,
  AccountExportRepository,
  type AccountExportRow,
  type AccountExportSection,
} from "~/modules/account/infrastructure/AccountExportRepository";
import type { User } from "~/types";

import { streamAccountExport } from "../exportAccountData";

const user = { id: 7, name: "Sam", email: "sam@example.com" } as User;

function bodyOf(text: string) {
  return new Blob([text]).stream();
}

async function runExport(sections: Partial<Record<AccountExportSection, AccountExportRow[]>>) {
  const listSection = vi.fn(async (section: AccountExportSection, _userId: number, after: string) =>
    (sections[section] ?? [])
      .filter((row) => String(row.id) > after)
      .slice(0, ACCOUNT_EXPORT_PAGE_SIZE),
  );
  const listMessages = vi.fn(async (ids: readonly string[], after: string) =>
    after ? [] : ids.map((id) => ({ id: `m-${id}`, conversation_id: id, citations: "[1]" })),
  );
  let finished: Promise<unknown> = Promise.resolve();
  const context = {
    repositories: fakeRepositories([[AccountExportRepository, { listSection, listMessages }]]),
    waitUntil: (work: Promise<unknown>) => {
      finished = work;
    },
  } as unknown as ServiceContext;

  const archive = await new Response(streamAccountExport(context, user)).arrayBuffer();

  await finished;

  const entries = unzipSync(new Uint8Array(archive));
  const read = (path: string) => JSON.parse(strFromU8(entries[path]));

  return { entries, read, listSection, listMessages };
}

describe("streamAccountExport", () => {
  it("includes stored files without exposing storage keys or file paths from names", async () => {
    getObjectBody.mockImplementation(async (key: string) =>
      key === "private/one" ? { size: 5, body: bodyOf("bytes") } : null,
    );

    const { entries, read } = await runExport({
      sources: [
        {
          id: "s1",
          title: "Notes",
          filename: "../../secret.txt",
          storage_key: "private/one",
          external_uri: "https://example.com/doc?token=abc123&page=2",
        },
      ],
      outputs: [{ id: "o1", title: "Gone", filename: "gone.png", storage_key: "private/two" }],
    });

    expect(strFromU8(entries["files/sources/s1/secret.txt"])).toBe("bytes");

    const [source] = read("data/sources.json");

    expect(source).not.toHaveProperty("storage_key");
    expect(source.external_uri).not.toContain("abc123");
    expect(read("manifest.json").files).toEqual({
      included: 1,
      omitted: [{ section: "outputs", resource_id: "o1", reason: "missing" }],
    });
  });

  it("pages through every row and exports messages for the person's conversations only", async () => {
    const conversations = Array.from({ length: ACCOUNT_EXPORT_PAGE_SIZE + 1 }, (_, index) => ({
      id: `c${String(index).padStart(4, "0")}`,
    }));

    const { read, listSection, listMessages } = await runExport({ conversations });

    expect(read("data/conversations.json")).toHaveLength(conversations.length);
    expect(listSection).toHaveBeenCalledWith(
      "conversations",
      user.id,
      conversations[ACCOUNT_EXPORT_PAGE_SIZE - 1].id,
    );

    const requested = listMessages.mock.calls.flatMap(([ids]) => ids);

    expect(new Set(requested)).toEqual(new Set(conversations.map(({ id }) => id)));

    const messages = read("data/messages.json");

    expect(messages).toHaveLength(conversations.length);
    expect(messages[0].citations).toEqual([1]);
    expect(read("manifest.json").counts).toMatchObject({
      conversations: conversations.length,
      messages: conversations.length,
    });
  });

  it("fails the download instead of delivering a partial archive", async () => {
    const context = {
      repositories: fakeRepositories([
        [
          AccountExportRepository,
          {
            listSection: async () => {
              throw new Error("database unavailable");
            },
          },
        ],
      ]),
      waitUntil: () => undefined,
    } as unknown as ServiceContext;

    await expect(new Response(streamAccountExport(context, user)).arrayBuffer()).rejects.toThrow(
      "database unavailable",
    );
  });
});
