import {
  buildSiteFrameDocument,
  validateSiteProject,
  SITE_CATALOG,
  SITE_COMPONENT_TYPES,
} from "@ngriffin_uk/polychat-library-sites";
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
  it("keeps Source text inside the initial JSON instead of creating executable markup", () => {
    const project = validateSiteProject({
      pages: {
        home: {
          path: "/",
          title: "Tasks",
          root: "page",
          elements: { page: { type: "Page", props: {}, children: [] } },
        },
      },
    }).project;
    const data = { tasks: [{ title: "</script><script id='injected'>alert(1)</script>" }] };
    const html = buildSiteFrameDocument({
      frameId: "frame",
      title: "Tasks",
      fontUrl: "https://fonts.example",
      runtimeUrl: "/runtime.js",
      stylesheetUrl: "/styles.css",
      initialProject: project,
      initialPageId: "home",
      initialData: data,
    });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("#injected")).toBeNull();
    expect(
      JSON.parse(document.querySelector("#site-initial-document")?.textContent ?? "{}").data,
    ).toEqual(data);
    expect(document.querySelectorAll("script")).toHaveLength(2);
  });
});
