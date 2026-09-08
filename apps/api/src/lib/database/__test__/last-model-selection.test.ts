import { readFileSync } from "node:fs";

import { updateUserSettingsSchema } from "@ngriffin_uk/polychat-schemas";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { prepareUserSettingsUpdates } from "../user-settings";

it("rejects malformed or oversized last-used locations", () => {
  expect(
    updateUserSettingsSchema.safeParse({
      last_model_selection: {
        modelId: "model",
        name: "Model",
        computeSite: "machine",
        locationLabel: "Office",
      },
    }).success,
  ).toBe(false);
  expect(
    updateUserSettingsSchema.safeParse({
      last_model_selection: {
        modelId: "x".repeat(513),
        name: "Model",
        computeSite: "hosted",
        locationLabel: "Cloud",
      },
    }).success,
  ).toBe(false);
});

describe("last-used model persistence", () => {
  it("migrates existing settings and round-trips a choice without replacing unrelated preferences", () => {
    const db = new Database(":memory:");

    try {
      db.exec(
        "CREATE TABLE user_settings (user_id INTEGER PRIMARY KEY, nickname TEXT); INSERT INTO user_settings VALUES (42, 'Nick'), (99, 'Other');",
      );
      db.exec(
        readFileSync(
          new URL("../../../../migrations/0050_brave_goblin_queen.sql", import.meta.url),
          "utf8",
        ),
      );
      const selection = {
        modelId: "machine/office/ollama/model",
        name: "Model",
        provider: "ollama",
        computeSite: "machine",
        machineId: "office",
        locationLabel: "Office PC",
      };
      const parsed = updateUserSettingsSchema.parse({ last_model_selection: selection });
      const updates = prepareUserSettingsUpdates(parsed);

      expect(Object.keys(updates)).toEqual(["last_model_selection"]);
      db.prepare("UPDATE user_settings SET last_model_selection = ? WHERE user_id = ?").run(
        updates.last_model_selection,
        42,
      );
      expect(db.prepare("SELECT * FROM user_settings WHERE user_id = 42").get()).toEqual({
        user_id: 42,
        nickname: "Nick",
        last_model_selection: JSON.stringify(selection),
      });
      expect(
        db.prepare("SELECT last_model_selection FROM user_settings WHERE user_id = 99").get(),
      ).toEqual({ last_model_selection: null });
      expect(prepareUserSettingsUpdates({ last_model_selection: null })).toEqual({
        last_model_selection: null,
      });
      expect(prepareUserSettingsUpdates({ nickname: "New" })).not.toHaveProperty(
        "last_model_selection",
      );
    } finally {
      db.close();
    }
  });
});
