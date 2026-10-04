import {
  siteCollectionSchema,
  siteDataBindingSchema,
  siteDataFieldNameSchema,
  siteDataIdentifierSchema,
  type SiteCollection,
  type SiteCollectionRecord,
  type SiteIssue,
  type SiteProject,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { getStatePath } from "./state.js";

export function validateSiteCollectionValues(
  collection: SiteCollection,
  values: SiteCollectionRecord["values"],
): string | null {
  for (const key of Object.keys(values)) {
    if (!Object.hasOwn(collection.fields, key)) {
      return `Unknown field: ${key}`;
    }
  }

  for (const [key, field] of Object.entries(collection.fields)) {
    const value = values[key];

    if (value === undefined) {
      if (field.required) {
        return `Required field: ${key}`;
      }
    } else if (
      typeof value !== field.type ||
      (typeof value === "number" && !Number.isFinite(value))
    ) {
      return `Invalid ${field.type} field: ${key}`;
    } else if (field.required && typeof value === "string" && !value.trim()) {
      return `Required field: ${key}`;
    }
  }

  return null;
}

export function normaliseSiteSourceRows(
  value: unknown,
): Record<string, string | number | boolean>[] {
  if (!Array.isArray(value) || value.length > 500) {
    throw new Error("Site data must contain at most 500 rows");
  }

  const rows = value.map((row) => {
    if (!isRecord(row) || Object.keys(row).length > 40) {
      throw new Error("Site data rows must be objects with at most 40 fields");
    }

    const result: Record<string, string | number | boolean> = {};

    for (const [key, field] of Object.entries(row)) {
      if (!siteDataFieldNameSchema.safeParse(key).success) {
        throw new Error("Invalid site data field name");
      }

      if (typeof field === "string" && field.length <= 4000) {
        result[key] = field;
      } else if (
        typeof field === "boolean" ||
        (typeof field === "number" && Number.isFinite(field))
      ) {
        result[key] = field;
      } else if (field !== null) {
        throw new Error("Site data fields must contain text, numbers or booleans");
      }
    }

    return result;
  });

  if (JSON.stringify(rows).length > 250_000) {
    throw new Error("Site data is too large");
  }

  return rows;
}

export function normaliseSiteIntegrations(raw: Record<string, unknown>, project: SiteProject) {
  const issues: SiteIssue[] = [];
  const collections: NonNullable<SiteProject["collections"]> = {};
  const dataBindings: NonNullable<SiteProject["dataBindings"]> = {};

  if (raw.collections !== undefined && !isRecord(raw.collections)) {
    issues.push({ severity: "error", message: "Collections must be an object" });
  }

  if (raw.dataBindings !== undefined && !isRecord(raw.dataBindings)) {
    issues.push({ severity: "error", message: "Data bindings must be an object" });
  }

  for (const [id, definition] of Object.entries(isRecord(raw.collections) ? raw.collections : {})) {
    const parsed = siteCollectionSchema.safeParse(definition);

    if (
      !siteDataIdentifierSchema.safeParse(id).success ||
      !parsed.success ||
      Object.keys(collections).length >= 20
    ) {
      issues.push({ severity: "error", message: `Invalid collection: ${id}` });
      continue;
    }

    collections[id] = parsed.data;
  }

  for (const [id, definition] of Object.entries(
    isRecord(raw.dataBindings) ? raw.dataBindings : {},
  )) {
    const parsed = siteDataBindingSchema.safeParse(definition);

    if (
      !siteDataIdentifierSchema.safeParse(id).success ||
      !parsed.success ||
      Object.keys(dataBindings).length >= 40
    ) {
      issues.push({ severity: "error", message: `Invalid data binding: ${id}` });
      continue;
    }

    const binding = parsed.data;

    if (
      !Object.hasOwn(project.pages, binding.pageId) ||
      (binding.kind === "collection" && !Object.hasOwn(collections, binding.collectionId))
    ) {
      issues.push({
        severity: "error",
        message: `Data binding ${id} references a missing page or collection`,
      });
      continue;
    }

    const duplicate = Object.values(dataBindings).some(
      (existing) =>
        existing.pageId === binding.pageId &&
        (existing.statePath === binding.statePath ||
          existing.statePath.startsWith(`${binding.statePath}/`) ||
          binding.statePath.startsWith(`${existing.statePath}/`)),
    );

    if (duplicate) {
      issues.push({ severity: "error", message: `Data binding ${id} overlaps another binding` });
      continue;
    }

    dataBindings[id] = binding;
  }

  return {
    collections: raw.collections === undefined ? undefined : collections,
    dataBindings: raw.dataBindings === undefined ? undefined : dataBindings,
    issues,
  };
}

export function projectSiteSourceRows(
  value: unknown,
  path: string,
  fields: Record<string, string>,
) {
  const rows = getStatePath(value, path);

  if (!Array.isArray(rows)) {
    throw new Error("The selected connector result is not a list");
  }

  return normaliseSiteSourceRows(
    Object.keys(fields).length > 0
      ? rows.map((row) =>
          Object.fromEntries(
            Object.entries(fields).map(([name, fieldPath]) => [
              name,
              getStatePath(row, fieldPath) ?? null,
            ]),
          ),
        )
      : rows,
  );
}
