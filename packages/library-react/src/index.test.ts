import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createSurfaceControlsContext } from "./index.js";

describe("surface controls context", () => {
  it("fails clearly when the provider is missing", () => {
    const { useSurfaceControls } = createSurfaceControlsContext();

    function Consumer() {
      useSurfaceControls();

      return null;
    }

    expect(() => renderToStaticMarkup(createElement(Consumer))).toThrow(
      "useSurfaceControls must be used within a SurfaceControlsProvider",
    );
  });
});
