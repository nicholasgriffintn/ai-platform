import { describe, expect, it } from "vitest";

import { extractQuotes } from "../extract";

describe("extractQuotes", () => {
  it("should extract quotes from text", () => {
    const text = 'He said "Hello world" and then "Goodbye cruel world"';
    const result = extractQuotes(text);
    expect(result).toEqual(["Hello world", "Goodbye cruel world"]);
  });

  it("should ignore quotes that are too short", () => {
    const text = 'He said "Hi" and then "Goodbye cruel world"';
    const result = extractQuotes(text);
    expect(result).toEqual(["Goodbye cruel world"]);
  });

  it("should ignore quotes that are just numbers", () => {
    const text = 'The numbers are "12345" and "Hello world"';
    const result = extractQuotes(text);
    expect(result).toEqual(["Hello world"]);
  });

  it("should return unique quotes only", () => {
    const text = 'He said "Hello world" and then repeated "Hello world"';
    const result = extractQuotes(text);
    expect(result).toEqual(["Hello world"]);
  });

  it("should return an empty array if no quotes are found", () => {
    const text = "This text has no quotes";
    const result = extractQuotes(text);
    expect(result).toEqual([]);
  });
});
