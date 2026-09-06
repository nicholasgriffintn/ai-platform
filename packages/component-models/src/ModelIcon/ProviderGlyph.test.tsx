import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProviderGlyph } from "./ProviderGlyph";

afterEach(() => {
  cleanup();
});

describe("ProviderGlyph", () => {
  it("resolves provider aliases to the same artwork the model icon uses", async () => {
    render(<ProviderGlyph name="google-ai-studio" size={16} fallback={<span>G</span>} />);

    expect(await screen.findByTitle("Google")).toBeTruthy();
    expect(screen.queryByText("G")).toBeNull();
  });

  it("keeps the fallback for providers without artwork", () => {
    render(<ProviderGlyph name="no-such-provider" fallback={<span>N</span>} />);

    expect(screen.getByText("N")).toBeTruthy();
  });
});
