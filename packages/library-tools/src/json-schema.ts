import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export function flattenObjectRootSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const alternatives = schema.anyOf;

  if (
    !Array.isArray(alternatives) ||
    alternatives.length === 0 ||
    !alternatives.every((alternative) => isRecord(alternative) && alternative.type === "object")
  ) {
    return schema;
  }

  const objectAlternatives = alternatives.filter(isRecord);
  const { anyOf: _alternatives, ...root } = schema;
  const properties = new Map<string, unknown>(
    isRecord(root.properties) ? Object.entries(root.properties) : [],
  );
  const requiredCounts = new Map<string, number>();

  for (const alternative of objectAlternatives) {
    if (isRecord(alternative.properties)) {
      for (const [key, value] of Object.entries(alternative.properties)) {
        const existing = properties.get(key);

        properties.set(
          key,
          existing === undefined
            ? value
            : {
                anyOf: [
                  ...(isRecord(existing) && Array.isArray(existing.anyOf)
                    ? existing.anyOf
                    : [existing]),
                  value,
                ],
              },
        );
      }
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
    properties: Object.fromEntries(properties),
    ...(required.length > 0 ? { required } : {}),
    ...(closed ? { additionalProperties: false } : {}),
  };
}
