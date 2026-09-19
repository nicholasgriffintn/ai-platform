import { SITE_CATALOG, SITE_COMPONENT_TYPES } from "@ngriffin_uk/polychat-library-sites";
import type { SiteProject } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SitePreview } from "../SitePreview.js";
import { SiteRenderer } from "../SiteRenderer.js";

const project: SiteProject = {
  title: "Crumb",
  theme: { palette: "sunset", font: "display", radius: "lg", mode: "dark" },
  pages: {
    home: {
      path: "/",
      title: "Home",
      root: "page",
      elements: {
        page: { type: "Page", props: {}, children: ["nav", "hero", "ghost"] },
        nav: {
          type: "Navbar",
          props: { brand: "Crumb", links: [{ label: "Pricing", href: "/pricing" }] },
          children: [],
        },
        hero: {
          type: "Hero",
          props: {
            headline: "Cakes worth the drive",
            primaryCta: { label: "Order", href: "#order" },
          },
          children: [],
        },
      },
    },
    pricing: {
      path: "/pricing",
      title: "Pricing",
      root: "page",
      elements: {
        page: { type: "Page", props: {}, children: ["heading"] },
        heading: { type: "Heading", props: { text: "Simple pricing", level: 1 }, children: [] },
      },
    },
  },
};

describe("SitePreview", () => {
  afterEach(cleanup);

  function frameOf(container: HTMLElement) {
    const frame = container.querySelector("iframe") as HTMLIFrameElement;
    const doc = frame.contentDocument as Document;

    return { frame, doc, within: within(doc.body) };
  }

  it("renders the page tree inside an isolated frame with the site theme applied", () => {
    const { container } = render(<SitePreview project={project} />);
    const { doc, within: inFrame } = frameOf(container);

    expect(inFrame.getByRole("heading", { level: 1, name: "Cakes worth the drive" })).toBeTruthy();
    expect(doc.documentElement.classList.contains("dark")).toBe(true);
    expect(doc.documentElement.style.getPropertyValue("--primary")).toContain("oklch");
    expect(doc.documentElement.style.getPropertyValue("--radius")).toBe("1rem");
    expect(doc.body.dataset.sitePreview).toBe("");
  });

  it("switches pages when an internal link is followed", () => {
    const onNavigate = vi.fn();
    const view = render(<SitePreview project={project} onNavigate={onNavigate} />);
    const { within: inFrame } = frameOf(view.container);

    fireEvent.click(inFrame.getByRole("link", { name: "Pricing" }));
    expect(onNavigate).toHaveBeenCalledWith("pricing");

    view.rerender(<SitePreview project={project} pageId="pricing" onNavigate={onNavigate} />);
    expect(inFrame.getByRole("heading", { level: 1, name: "Simple pricing" })).toBeTruthy();
  });

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
