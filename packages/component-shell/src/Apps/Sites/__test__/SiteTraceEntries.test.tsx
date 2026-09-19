import type { SiteTraceEntry } from "@ngriffin_uk/polychat-schemas";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteTraceEntries } from "../SiteTraceEntries.js";

const entries: SiteTraceEntry[] = [
  {
    kind: "decision",
    version: 1,
    id: "site-1:plan",
    stage: "plan",
    source: "decision",
    summary: "Marketing site, several pages",
    effects: ["Use the low coding tier", "Write in a friendly voice"],
    questions: [
      {
        id: "kind",
        question: {
          type: "choice",
          instructions: "What kind of site is this?",
          criteria: {
            marketing:
              "A multi-page marketing site with several destinations such as pricing, about or contact.",
            landing: "A single-page landing page selling one product, service or idea.",
            component: "One reusable UI component or section rather than a page.",
          },
        },
        answer: {
          type: "choice",
          choice: "marketing",
          probabilities: { marketing: 0.99, landing: 0.01, component: 0 },
          confidence: 0.99,
        },
      },
    ],
    provider: "typesafe",
    model: "jev-latest",
    durationMs: 148,
    createdAt: "2026-09-19T12:00:00.000Z",
  },
  {
    kind: "decision",
    version: 1,
    id: "site-1:quality",
    stage: "quality",
    source: "decision",
    summary: "Quality review passed",
    effects: ["31% placeholder probability", "Keep the result"],
    questions: [
      {
        id: "placeholders",
        question: {
          type: "noul",
          instructions: "Does the copy contain placeholder or generic filler?",
        },
        answer: { type: "noul", noul: 0.31 },
      },
    ],
    provider: "typesafe",
    model: "jev-latest",
    durationMs: 92,
    createdAt: "2026-09-19T12:00:01.000Z",
  },
  {
    kind: "generation",
    version: 1,
    id: "site-1:build",
    stage: "build",
    outcome: "applied",
    summary: "Built the site with 12 updates",
    provider: "openai",
    model: "gpt-test",
    patchCount: 12,
    rejectedPatchCount: 0,
    durationMs: 1200,
    createdAt: "2026-09-19T12:00:02.000Z",
  },
];

describe("SiteTraceEntries", () => {
  it("shows decision and generation steps with expandable probabilities", () => {
    render(<SiteTraceEntries entries={entries} />);

    expect(screen.getByText("Marketing site, several pages")).toBeInTheDocument();
    expect(screen.getByText("Built the site with 12 updates")).toBeInTheDocument();

    const details = screen.getByText("Marketing site, several pages").closest("details");

    expect(details?.hasAttribute("open")).toBe(false);
    fireEvent.click(
      screen.getByText("Marketing site, several pages").closest("summary") as HTMLElement,
    );
    expect(details?.hasAttribute("open")).toBe(true);
    expect(screen.getByText("What kind of site is this?")).toBeInTheDocument();
    expect(screen.getByText("Marketing · 99%")).toBeInTheDocument();
    expect(screen.getByText("99.0%")).toBeInTheDocument();
  });

  it("shows the resolved boolean winner rather than always presenting yes as selected", () => {
    render(<SiteTraceEntries entries={entries} />);

    fireEvent.click(screen.getByText("Quality review passed").closest("summary") as HTMLElement);

    expect(screen.getByText("No · 69%")).toBeInTheDocument();
    expect(screen.getByText("No").closest("[data-selected]")).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(screen.getByText("Yes").closest("[data-selected]")).toHaveAttribute(
      "data-selected",
      "false",
    );
  });

  it("renders nothing when a turn has no trace", () => {
    const { container } = render(<SiteTraceEntries entries={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
