import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { z } from "zod";

import {
  SITE_CATALOG,
  SITE_COMPONENT_CATEGORIES,
  SITE_ICON_NAMES,
  type SiteComponentCategory,
  type SiteComponentType,
} from "./catalog.js";

type JsonSchema = Record<string, unknown>;

function describeJsonSchema(schema: unknown, iconEnum: string): string {
  if (!isRecord(schema)) {
    return "unknown";
  }

  if (Array.isArray(schema.enum)) {
    const values = schema.enum as unknown[];

    if (values.length === SITE_ICON_NAMES.length && values.includes("sparkles")) {
      return iconEnum;
    }

    return values.map((value) => JSON.stringify(value)).join(" | ");
  }

  if (Array.isArray(schema.anyOf)) {
    return (schema.anyOf as unknown[])
      .map((entry) => describeJsonSchema(entry, iconEnum))
      .join(" | ");
  }

  switch (schema.type) {
    case "string":
      return "string";
    case "number":
    case "integer": {
      const bounds = [schema.minimum, schema.maximum]
        .filter((value) => typeof value === "number")
        .join("-");

      return bounds ? `number (${bounds})` : "number";
    }

    case "boolean":
      return "boolean";
    case "array":
      return `${describeJsonSchema(schema.items, iconEnum)}[]`;
    case "object": {
      const properties = isRecord(schema.properties) ? schema.properties : {};
      const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
      const entries = Object.entries(properties).map(
        ([key, value]) =>
          `${key}${required.has(key) ? "" : "?"}: ${describeJsonSchema(value, iconEnum)}`,
      );

      if (entries.length === 0) {
        return isRecord(schema.additionalProperties) || schema.additionalProperties === true
          ? "Record<string, string>"
          : "{}";
      }

      return `{ ${entries.join(", ")} }`;
    }

    default:
      return "unknown";
  }
}

const CATEGORY_LABELS: Record<SiteComponentCategory, string> = {
  layout: "Layout",
  navigation: "Navigation",
  section: "Composed sections",
  content: "Content",
  form: "Forms",
  data: "Data",
};

export function describeSiteComponent(type: SiteComponentType): string {
  const definition = SITE_CATALOG[type];
  const jsonSchema = z.toJSONSchema(definition.props, { unrepresentable: "any" }) as JsonSchema;
  const props = describeJsonSchema(jsonSchema, "Icon");
  const children = definition.acceptsChildren ? " (accepts children)" : "";

  return `- ${type}${children}: ${definition.description}\n  props ${props}`;
}

export function describeSiteCatalog(include?: readonly SiteComponentType[]): string {
  const allowed = include ? new Set(include) : null;
  const sections = SITE_COMPONENT_CATEGORIES.flatMap((category) => {
    const entries = (Object.keys(SITE_CATALOG) as SiteComponentType[])
      .filter((type) => SITE_CATALOG[type].category === category && (!allowed || allowed.has(type)))
      .map(describeSiteComponent);

    return entries.length ? [`${CATEGORY_LABELS[category]}\n${entries.join("\n")}`] : [];
  });

  return [...sections, `Icon is one of: ${SITE_ICON_NAMES.join(", ")}`].join("\n\n");
}

export function buildSiteExampleStream(include?: readonly SiteComponentType[]): string {
  const application = include ? !include.includes("Hero") && include.includes("AppShell") : false;
  const lines = application
    ? [
        { op: "add", path: "/title", value: "Ledger" },
        { op: "add", path: "/description", value: "Invoices and customers for a small studio." },
        {
          op: "add",
          path: "/pages/home",
          value: {
            path: "/",
            title: "Overview",
            root: "page",
            state: { tab: "open", invoices: [{ id: "i1", customer: "Northwind", status: "open" }] },
            elements: {},
          },
        },
        {
          op: "add",
          path: "/pages/home/elements/page",
          value: { type: "Page", props: {}, children: ["shell"] },
        },
        {
          op: "add",
          path: "/pages/home/elements/shell",
          value: {
            type: "AppShell",
            props: SITE_CATALOG.AppShell.example,
            children: ["metrics", "table"],
          },
        },
        {
          op: "add",
          path: "/pages/home/elements/metrics",
          value: { type: "Grid", props: { columns: 3 }, children: ["revenue"] },
        },
        {
          op: "add",
          path: "/pages/home/elements/revenue",
          value: { type: "Metric", props: SITE_CATALOG.Metric.example, children: [] },
        },
        {
          op: "add",
          path: "/pages/home/elements/table",
          value: {
            type: "Table",
            props: {
              columns: [
                { key: "id", label: "Invoice" },
                { key: "customer", label: "Customer" },
                { key: "status", label: "Status" },
              ],
              rows: { $state: "/invoices", where: { status: { $state: "/tab" } } },
            },
            children: [],
          },
        },
      ]
    : [
        { op: "add", path: "/title", value: "Acme" },
        { op: "add", path: "/description", value: "Invoicing for small studios." },
        {
          op: "add",
          path: "/pages/home",
          value: { path: "/", title: "Home", root: "page", elements: {} },
        },
        {
          op: "add",
          path: "/pages/home/elements/page",
          value: { type: "Page", props: {}, children: ["nav", "hero", "features", "footer"] },
        },
        {
          op: "add",
          path: "/pages/home/elements/nav",
          value: { type: "Navbar", props: SITE_CATALOG.Navbar.example, children: [] },
        },
        {
          op: "add",
          path: "/pages/home/elements/hero",
          value: { type: "Hero", props: SITE_CATALOG.Hero.example, children: [] },
        },
        {
          op: "add",
          path: "/pages/home/elements/features",
          value: { type: "FeatureGrid", props: SITE_CATALOG.FeatureGrid.example, children: [] },
        },
        {
          op: "add",
          path: "/pages/home/elements/footer",
          value: { type: "Footer", props: SITE_CATALOG.Footer.example, children: [] },
        },
      ];

  return lines.map((line) => JSON.stringify(line)).join("\n");
}
