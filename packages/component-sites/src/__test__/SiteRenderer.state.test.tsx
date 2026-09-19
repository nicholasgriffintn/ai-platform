import type { SitePage } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteRenderer } from "../SiteRenderer.js";

const page: SitePage = {
  path: "/",
  title: "Orders",
  root: "page",
  state: {
    tab: "open",
    draft: "",
    orders: [
      { id: "o1", customer: "Northwind", status: "open" },
      { id: "o2", customer: "Contoso", status: "paid" },
    ],
  },
  elements: {
    page: { type: "Page", props: {}, children: ["tabs", "draft", "order", "add", "empty"] },
    tabs: {
      type: "Tabs",
      props: {
        tabs: [
          { label: "Open", value: "open" },
          { label: "Paid", value: "paid" },
        ],
        value: { $bindState: "/tab" },
      },
      children: [],
    },
    draft: {
      type: "Input",
      props: { label: "Customer", value: { $bindState: "/draft" } },
      children: [],
    },
    order: {
      type: "Card",
      props: { title: { $item: "customer" } },
      repeat: { statePath: "/orders", key: "id" },
      visible: { $item: "status", eq: { $state: "/tab" } },
      children: ["remove"],
    },
    remove: {
      type: "Button",
      props: { label: "Remove" },
      on: { press: { action: "removeState", params: { statePath: "/orders" } } },
      children: [],
    },
    add: {
      type: "Button",
      props: { label: "Add" },
      on: {
        press: {
          action: "pushState",
          params: {
            statePath: "/orders",
            value: { id: { $id: true }, customer: { $state: "/draft" }, status: "open" },
            clearStatePath: "/draft",
          },
        },
      },
      children: [],
    },
    empty: {
      type: "Text",
      props: { text: "Nothing here" },
      visible: { $state: "/orders", truthy: false },
      children: [],
    },
  },
};

describe("SiteRenderer state", () => {
  afterEach(cleanup);

  it("binds, filters, adds and removes through the page state", () => {
    const view = render(<SiteRenderer page={page} />);
    const screen = within(view.container);

    expect(screen.getByRole("heading", { name: "Northwind" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Contoso" })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Paid" }));
    expect(screen.getByRole("heading", { name: "Contoso" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Northwind" })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Open" }));
    fireEvent.change(screen.getByLabelText("Customer"), { target: { value: "Fabrikam" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByRole("heading", { name: "Fabrikam" })).toBeTruthy();
    expect((screen.getByLabelText("Customer") as HTMLInputElement).value).toBe("");

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.queryByRole("heading", { name: "Northwind" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Fabrikam" })).toBeTruthy();
  });
});
