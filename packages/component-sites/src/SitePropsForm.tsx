import { Checkbox, cn, Input, Label, Textarea } from "@ngriffin_uk/polychat-component-ui";
import {
  isDynamicValue,
  SITE_CATALOG,
  type SiteComponentType,
} from "@ngriffin_uk/polychat-library-sites";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { useMemo, useState } from "react";
import { z } from "zod";

type JsonSchema = Record<string, unknown>;

interface FieldDefinition {
  key: string;
  required: boolean;
  schema: JsonSchema;
}

const LONG_TEXT_KEYS = new Set([
  "description",
  "text",
  "quote",
  "answer",
  "excerpt",
  "bio",
  "code",
  "tagline",
]);

function readFields(type: SiteComponentType): FieldDefinition[] {
  const jsonSchema = z.toJSONSchema(SITE_CATALOG[type].props, {
    unrepresentable: "any",
  }) as JsonSchema;
  const properties = isRecord(jsonSchema.properties) ? jsonSchema.properties : {};
  const required = new Set(
    Array.isArray(jsonSchema.required) ? (jsonSchema.required as string[]) : [],
  );

  return Object.entries(properties).map(([key, schema]) => ({
    key,
    required: required.has(key),
    schema: isRecord(schema) ? schema : {},
  }));
}

function fieldKind(
  field: FieldDefinition,
  value: unknown,
): "dynamic" | "enum" | "boolean" | "number" | "text" | "lines" | "json" {
  if (isDynamicValue(value)) {
    return "dynamic";
  }

  const { schema } = field;

  if (Array.isArray(schema.enum)) {
    return "enum";
  }

  if (schema.type === "boolean") {
    return "boolean";
  }

  if (schema.type === "number" || schema.type === "integer") {
    return "number";
  }

  if (schema.type === "string") {
    return "text";
  }

  if (schema.type === "array" && isRecord(schema.items) && schema.items.type === "string") {
    return "lines";
  }

  return "json";
}

function JsonField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [invalid, setInvalid] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (lastValue !== value) {
    setLastValue(value);
    setDraft(JSON.stringify(value ?? null, null, 2));
    setInvalid(false);
  }

  return (
    <Textarea
      id={id}
      value={draft}
      rows={Math.min(14, Math.max(3, draft.split("\n").length))}
      spellCheck={false}
      aria-invalid={invalid || undefined}
      className={cn("font-mono text-xs", invalid && "border-destructive")}
      onChange={(event) => {
        setDraft(event.target.value);

        try {
          const parsed: unknown = JSON.parse(event.target.value);

          setInvalid(false);
          onChange(parsed);
        } catch {
          setInvalid(true);
        }
      }}
    />
  );
}

export interface SitePropsFormProps {
  type: SiteComponentType;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
  className?: string;
}

export function SitePropsForm({ type, props, onChange, className }: SitePropsFormProps) {
  const fields = useMemo(() => readFields(type), [type]);

  const update = (key: string, value: unknown) => {
    const next = { ...props };

    if (value === undefined || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }

    onChange(next);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {fields.map((field) => {
        const id = `site-prop-${field.key}`;
        const value = props[field.key];
        const kind = fieldKind(field, value);
        const description =
          typeof field.schema.description === "string" ? field.schema.description : undefined;

        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="text-xs text-muted-foreground">
              {field.key}
              {field.required && <span className="text-destructive"> *</span>}
              {kind === "dynamic" && <span className="ml-1 font-mono">(state)</span>}
            </Label>
            {kind === "enum" && (
              <select
                id={id}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => update(field.key, event.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {!field.required && <option value="">default</option>}
                {(field.schema.enum as unknown[]).map((option) => (
                  <option key={String(option)} value={String(option)}>
                    {String(option)}
                  </option>
                ))}
              </select>
            )}
            {kind === "boolean" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={Boolean(value)}
                  onCheckedChange={(checked) => update(field.key, checked === true)}
                />
                <span className="text-xs text-muted-foreground">{description}</span>
              </div>
            )}
            {kind === "number" && (
              <Input
                id={id}
                type="number"
                value={typeof value === "number" ? value : ""}
                onChange={(event) =>
                  update(
                    field.key,
                    event.target.value === "" ? undefined : Number(event.target.value),
                  )
                }
                className="h-8 text-sm"
              />
            )}
            {kind === "text" &&
              (LONG_TEXT_KEYS.has(field.key) || (typeof value === "string" && value.length > 80) ? (
                <Textarea
                  id={id}
                  value={typeof value === "string" ? value : ""}
                  rows={3}
                  onChange={(event) => update(field.key, event.target.value)}
                  className="text-sm"
                />
              ) : (
                <Input
                  id={id}
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) => update(field.key, event.target.value)}
                  className="h-8 text-sm"
                />
              ))}
            {kind === "lines" && (
              <Textarea
                id={id}
                value={Array.isArray(value) ? value.map(String).join("\n") : ""}
                rows={4}
                onChange={(event) =>
                  update(
                    field.key,
                    event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  )
                }
                className="text-sm"
              />
            )}
            {(kind === "json" || kind === "dynamic") && (
              <JsonField id={id} value={value} onChange={(next) => update(field.key, next)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
