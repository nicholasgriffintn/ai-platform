import { describe, expect, it } from "vitest";

import {
  arrangeProjectWorkbenchColumns,
  isProjectWorkbenchPaneFullHeight,
  openProjectWorkbenchPane,
  PROJECT_WORKBENCH_MAX_OPEN_PANES,
} from "./project-workbench.js";

describe("openProjectWorkbenchPane", () => {
  it("keeps an already open pane in place", () => {
    expect(openProjectWorkbenchPane(["files", "artifact"], "files")).toEqual(["files", "artifact"]);
  });

  it("drops the oldest pane once the workbench is full", () => {
    const full = openProjectWorkbenchPane(
      openProjectWorkbenchPane(
        openProjectWorkbenchPane(openProjectWorkbenchPane([], "files"), "artifact"),
        "activity",
      ),
      "preview",
    );

    expect(full).toHaveLength(PROJECT_WORKBENCH_MAX_OPEN_PANES);
    expect(openProjectWorkbenchPane(full, "changes")).toEqual([
      "artifact",
      "activity",
      "preview",
      "changes",
    ]);
  });
});

describe("arrangeProjectWorkbenchColumns", () => {
  it("gives the first pane a full column and halves it when a second arrives", () => {
    expect(arrangeProjectWorkbenchColumns(["files"], 2)).toEqual([["files"]]);
    expect(arrangeProjectWorkbenchColumns(["files", "artifact"], 2)).toEqual([
      ["files", "artifact"],
    ]);
  });

  it("lets only a pane alone in its column take the full height", () => {
    expect([0].map((index) => isProjectWorkbenchPaneFullHeight(index, 1))).toEqual([true]);
    expect([0, 1].map((index) => isProjectWorkbenchPaneFullHeight(index, 2))).toEqual([
      false,
      false,
    ]);
    expect([0, 1, 2].map((index) => isProjectWorkbenchPaneFullHeight(index, 3))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("starts a new column for the third pane", () => {
    expect(arrangeProjectWorkbenchColumns(["files", "artifact", "activity"], 2)).toEqual([
      ["files", "artifact"],
      ["activity"],
    ]);
  });

  it("shows only the newest panes that fit the available columns", () => {
    expect(arrangeProjectWorkbenchColumns(["files", "artifact", "activity"], 1)).toEqual([
      ["artifact", "activity"],
    ]);
  });
});
