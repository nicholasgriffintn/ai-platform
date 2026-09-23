import { SITE_CATALOG, SITE_COMPONENT_TYPES } from "@ngriffin_uk/polychat-library-sites";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteRenderer } from "../SiteRenderer.js";

describe("SitePreview", () => {
  afterEach(cleanup);

  it("renders every catalogue component from its example props", () => {
    const elements = Object.fromEntries(
      SITE_COMPONENT_TYPES.filter((type) => type !== "Page").map((type) => [
        type.toLowerCase(),
        { type, props: SITE_CATALOG[type].example, children: [] },
      ]),
    );
    const page = {
      path: "/",
      title: "All",
      root: "page",
      elements: {
        page: { type: "Page", props: {}, children: Object.keys(elements) },
        ...elements,
      },
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { container } = render(<SiteRenderer page={page} />);

    expect(warn).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Ship the thing you keep talking about");
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(5);
    warn.mockRestore();
  });
});
