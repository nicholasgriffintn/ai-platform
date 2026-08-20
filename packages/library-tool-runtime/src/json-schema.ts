function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Providers accept a single object schema at a tool's root. Zod renders
 * mutually exclusive argument sets as `anyOf`, which several providers reject
 * outright, so the alternatives are merged into one object and only the
 * requirements every alternative shares survive as `required`.
 */
export function flattenObjectRootSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const alternatives = schema.anyOf;

  if (
    !Array.isArray(alternatives) ||
    alternatives.length === 0 ||
    !alternatives.every((alternative) => isRecord(alternative) && alternative.type === "object")
  ) {
    return schema;
  }

  const objectAlternatives = alternatives as Array<Record<string, unknown>>;
  const { anyOf: _alternatives, ...root } = schema;
  const properties: Record<string, unknown> = isRecord(root.properties)
    ? { ...root.properties }
    : {};
  const requiredCounts = new Map<string, number>();

  for (const alternative of objectAlternatives) {
    if (isRecord(alternative.properties)) {
      Object.assign(properties, alternative.properties);
    }

    const required = Array.isArray(alternative.required) ? alternative.required : [];

    for (const key of new Set(required)) {
      if (typeof key === "string") {
        requiredCounts.set(key, (requiredCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const required = [...requiredCounts.entries()]
    .filter(([, count]) => count === objectAlternatives.length)
    .map(([key]) => key);
  const closed = objectAlternatives.every(
    (alternative) => alternative.additionalProperties === false,
  );

  return {
    ...root,
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    ...(closed ? { additionalProperties: false } : {}),
  };
}
