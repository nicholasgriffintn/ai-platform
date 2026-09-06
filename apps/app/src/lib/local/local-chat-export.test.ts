import { describe, expect, it } from "vitest";

import type { Conversation } from "~/types";

import {
  buildLocalChatExport,
  localChatExportFilename,
  readLocalChatExport,
} from "./local-chat-export";

const conversation = { id: "c1", title: "Kept", messages: [] } as unknown as Conversation;

describe("local chat export", () => {
  it("round-trips the conversations it was given", () => {
    const exported = buildLocalChatExport([conversation], "2026-09-06T09:00:00.000Z");

    expect(exported.conversationCount).toBe(1);
    expect(readLocalChatExport(exported)).toEqual([conversation]);
  });

  it("refuses to read anything that is not a recognised export", () => {
    expect(readLocalChatExport(null)).toEqual([]);
    expect(readLocalChatExport("not an export")).toEqual([]);
    expect(readLocalChatExport({ conversations: [conversation] })).toEqual([]);
    expect(readLocalChatExport({ version: 99, conversations: [conversation] })).toEqual([]);
  });

  it("tolerates an export whose conversations are missing rather than throwing", () => {
    expect(readLocalChatExport({ version: 1, exportedAt: "x", conversationCount: 0 })).toEqual([]);
  });

  it("names the file by the day it was taken", () => {
    expect(localChatExportFilename("2026-09-06T09:00:00.000Z")).toBe(
      "polychat-browser-chats-2026-09-06.json",
    );
  });
});
