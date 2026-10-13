import { describe, expect, it } from "vitest";

import {
  buildOperationViews,
  filterOperations,
  formatOperationLabel,
  groupOperationsByAccess,
  haveSameMembers,
  pageOperationGroups,
  summariseSelection,
} from "./connectionGrantOperations";

const operations = buildOperationViews(
  [
    { id: "GITHUB_DELETE_A_REPOSITORY", access: "write", destructive: true, important: false },
    { id: "GITHUB_ADD_LABELS_TO_AN_ISSUE", access: "write", destructive: false, important: true },
    { id: "GITHUB_GET_AN_ISSUE", access: "read", destructive: false, important: true },
    { id: "GITHUB_LIST_PULL_REQUESTS", access: "read", destructive: false, important: false },
  ],
  "github",
);

describe("formatOperationLabel", () => {
  it("strips the provider prefix and humanises the id", () => {
    expect(formatOperationLabel("GITHUB_ADD_LABELS_TO_AN_ISSUE", "github")).toBe(
      "Add labels to an issue",
    );
    expect(formatOperationLabel("list_sites", "netlify")).toBe("List sites");
  });

  it("falls back to the raw id when nothing is left after the prefix", () => {
    expect(formatOperationLabel("GITHUB_", "github")).toBe("GITHUB_");
  });
});

describe("filterOperations", () => {
  it("matches every search term against the label or raw id", () => {
    const matches = filterOperations(operations, {
      query: "issue labels",
      access: "all",
      selected: new Set(),
    });

    expect(matches.map((operation) => operation.id)).toEqual(["GITHUB_ADD_LABELS_TO_AN_ISSUE"]);
    expect(
      filterOperations(operations, { query: "GET_AN", access: "all", selected: new Set() }).map(
        (operation) => operation.id,
      ),
    ).toEqual(["GITHUB_GET_AN_ISSUE"]);
  });

  it("narrows by access and by current selection", () => {
    expect(
      filterOperations(operations, { query: "", access: "read", selected: new Set() }).map(
        (operation) => operation.id,
      ),
    ).toEqual(["GITHUB_GET_AN_ISSUE", "GITHUB_LIST_PULL_REQUESTS"]);
    expect(
      filterOperations(operations, {
        query: "",
        access: "selected",
        selected: new Set(["GITHUB_DELETE_A_REPOSITORY"]),
      }).map((operation) => operation.id),
    ).toEqual(["GITHUB_DELETE_A_REPOSITORY"]);
  });
});

describe("groupOperationsByAccess", () => {
  it("keeps read before write and drops empty groups", () => {
    const groups = groupOperationsByAccess(operations);

    expect(groups.map((group) => group.access)).toEqual(["read", "write"]);
    expect(groupOperationsByAccess(operations.filter((o) => o.access === "read"))).toHaveLength(1);
  });
});

describe("pageOperationGroups", () => {
  it("fills the limit across groups in order and drops groups past it", () => {
    const groups = groupOperationsByAccess(operations);
    const pages = pageOperationGroups(groups, 3);

    expect(pages.map((page) => [page.group.access, page.visible.length])).toEqual([
      ["read", 2],
      ["write", 1],
    ]);
    expect(pageOperationGroups(groups, 2)).toHaveLength(1);
  });
});

describe("summariseSelection", () => {
  it("counts selected operations by access and destructiveness", () => {
    expect(
      summariseSelection(
        operations,
        new Set(["GITHUB_DELETE_A_REPOSITORY", "GITHUB_GET_AN_ISSUE", "unknown"]),
      ),
    ).toEqual({ total: 4, selected: 2, read: 1, write: 1, destructive: 1 });
  });
});

describe("haveSameMembers", () => {
  it("compares a set against a list regardless of order", () => {
    expect(haveSameMembers(new Set(["a", "b"]), ["b", "a"])).toBe(true);
    expect(haveSameMembers(new Set(["a"]), ["a", "b"])).toBe(false);
  });
});
