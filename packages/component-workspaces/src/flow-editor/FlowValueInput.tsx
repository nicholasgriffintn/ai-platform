import { FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectFlowValueBinding } from "@ngriffin_uk/polychat-schemas";

export function FlowValueInput({
  label,
  value,
  allowVariable = true,
  onChange,
}: {
  label: string;
  value: ProjectFlowValueBinding;
  allowVariable?: boolean;
  onChange: (value: ProjectFlowValueBinding) => void;
}) {
  const kind = value === null ? "empty" : typeof value === "object" ? "variable" : typeof value;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <FormSelect
        label={`${label} source`}
        value={kind}
        options={[
          { value: "string", label: "Text" },
          { value: "number", label: "Number" },
          { value: "boolean", label: "Checkbox" },
          { value: "empty", label: "Empty" },
          ...(allowVariable ? [{ value: "variable", label: "Flow value" }] : []),
        ]}
        onValueChange={(type) =>
          onChange(
            type === "variable"
              ? { variable: "result" }
              : type === "number"
                ? 0
                : type === "boolean"
                  ? false
                  : type === "empty"
                    ? null
                    : "",
          )
        }
      />
      {typeof value === "object" && value !== null ? (
        <FormInput
          label={label}
          value={value.variable}
          pattern="[a-z][a-z0-9_]{0,39}"
          required
          onChange={(event) => onChange({ variable: event.currentTarget.value })}
        />
      ) : typeof value === "boolean" ? (
        <FormSelect
          label={label}
          value={value ? "true" : "false"}
          options={[
            { value: "true", label: "Checked" },
            { value: "false", label: "Unchecked" },
          ]}
          onValueChange={(next) => onChange(next === "true")}
        />
      ) : value !== null ? (
        <FormInput
          label={label}
          type={typeof value === "number" ? "number" : "text"}
          step="any"
          value={value}
          onChange={(event) =>
            onChange(
              typeof value === "number"
                ? event.currentTarget.valueAsNumber
                : event.currentTarget.value,
            )
          }
        />
      ) : null}
    </div>
  );
}
