import { describe, expect, it } from "vitest";

import {
  buildActQuestions,
  clickableElements,
  elementOptionId,
  MAX_ACT_ELEMENTS,
  readPageElements,
} from "../act-questions";

const observation = {
  title: "Flights",
  text: "Search results",
  elements: [
    { role: "button", name: "Search", x: 100, y: 200 },
    { role: "input", name: "From", x: 10, y: 20, editable: true },
    { role: "a", name: "Next page", x: 300, y: 400 },
    { role: "button", name: 42, x: 1, y: 2 },
    { role: "button", name: "Broken", x: "nope", y: 2 },
    "not an element",
  ],
};

describe("readPageElements", () => {
  it("keeps only controls the desktop could actually click", () => {
    expect(readPageElements(observation)).toEqual([
      { role: "button", name: "Search", x: 100, y: 200, editable: false },
      { role: "input", name: "From", x: 10, y: 20, editable: true },
      { role: "a", name: "Next page", x: 300, y: 400, editable: false },
    ]);
  });

  it("returns nothing when the page exposed no element list", () => {
    expect(readPageElements({ title: "x" })).toEqual([]);
  });
});

describe("clickableElements", () => {
  it("leaves editable fields out, because typing needs supervised takeover", () => {
    expect(clickableElements(readPageElements(observation)).map((element) => element.name)).toEqual(
      ["Search", "Next page"],
    );
  });

  it("caps the menu so one request cannot grow without bound", () => {
    const many = Array.from({ length: 200 }, (_, index) => ({
      role: "button",
      name: `b${index}`,
      x: index,
      y: index,
    }));

    expect(clickableElements(readPageElements({ elements: many }))).toHaveLength(MAX_ACT_ELEMENTS);
  });
});

describe("buildActQuestions", () => {
  it("offers every clickable control plus the reading and stop options", () => {
    const clickable = clickableElements(readPageElements(observation));
    const questions = buildActQuestions({ goal: "find flights", observation, clickable });

    expect(questions.goal_reached.type).toBe("noul");
    expect(Object.keys(questions.next_action.criteria)).toEqual([
      elementOptionId(0),
      elementOptionId(1),
      "scroll_down",
      "scroll_up",
      "wait",
      "needs_input",
      "blocked",
    ]);
  });

  it("still offers a way forward on a page with no controls at all", () => {
    const questions = buildActQuestions({ goal: "read it", observation: {}, clickable: [] });

    expect(Object.keys(questions.next_action.criteria)).toEqual([
      "scroll_down",
      "scroll_up",
      "wait",
      "needs_input",
      "blocked",
    ]);
  });
});
