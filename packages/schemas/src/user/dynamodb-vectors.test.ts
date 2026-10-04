import { describe, expect, it } from "vitest";

import { updateUserSettingsSchema } from "./userSettings.js";

const configuration = {
  embedding_provider: "dynamodb-vectors",
  dynamodb_vectors_table_name: "polychat-vectors",
  dynamodb_vectors_index_name: "embeddings",
  dynamodb_vectors_region: "eu-west-2",
};

describe("DynamoDB vector settings validation", () => {
  it("requires a complete selection while permitting individual settings updates", () => {
    expect(updateUserSettingsSchema.safeParse(configuration).success).toBe(true);
    expect(
      updateUserSettingsSchema.safeParse({ embedding_provider: "dynamodb-vectors" }).success,
    ).toBe(false);
    expect(
      updateUserSettingsSchema.safeParse({ dynamodb_vectors_index_name: "embeddings-v2" }).success,
    ).toBe(true);
  });
  it.each([
    { dynamodb_vectors_table_name: "../another-table" },
    { dynamodb_vectors_index_name: "ab" },
    { dynamodb_vectors_region: "localhost" },
  ])("rejects unsafe resource configuration %#", (invalid) => {
    expect(updateUserSettingsSchema.safeParse({ ...configuration, ...invalid }).success).toBe(
      false,
    );
  });
});
