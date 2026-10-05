import { readFileSync } from "node:fs";

import { updateUserSettingsSchema } from "@ngriffin_uk/polychat-schemas";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { buildUserSettingsPatch, prepareUserSettingsUpdates } from "../user-settings";

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
  it("round-trips a choice without replacing unrelated preferences", () => {
    const db = new Database(":memory:");

    try {
      db.exec(
        readFileSync(new URL("../../../../migrations/0000_baseline.sql", import.meta.url), "utf8"),
      );
      db.exec(`
        PRAGMA foreign_keys = ON;
        INSERT INTO user (id, name, email) VALUES
          (42, 'Nick', 'nick@example.test'), (99, 'Other', 'other@example.test');
        INSERT INTO scoped_configuration (kind, id, user_id, payload)
        VALUES ('preferences', 'settings-42', 42, '{"nickname":"Nick"}'), ('preferences', 'settings-99', 99, '{"nickname":"Other"}');
      `);
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
      const patch = buildUserSettingsPatch(parsed);

      if (!patch) {
        throw new Error("Expected a last-model-selection patch");
      }

      db.prepare(
        `UPDATE scoped_configuration SET payload = ${patch.expression} WHERE kind = 'preferences' AND user_id = ?`,
      ).run(...patch.values, 42);
      expect(
        db
          .prepare(
            "SELECT user_id, json_extract(payload, '$.nickname') AS nickname, json_extract(payload, '$.last_model_selection') AS last_model_selection FROM scoped_configuration WHERE kind = 'preferences' AND user_id = 42",
          )
          .get(),
      ).toEqual({
        user_id: 42,
        nickname: "Nick",
        last_model_selection: JSON.stringify(selection),
      });
      expect(
        db
          .prepare(
            "SELECT json_extract(payload, '$.last_model_selection') AS last_model_selection FROM scoped_configuration WHERE kind = 'preferences' AND user_id = 99",
          )
          .get(),
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
