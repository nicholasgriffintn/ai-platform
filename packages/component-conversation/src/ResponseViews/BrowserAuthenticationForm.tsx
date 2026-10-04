import { Button, Input } from "@ngriffin_uk/polychat-component-ui";
import {
  browserCredentialOriginSchema,
  type BrowserApproval,
  type BrowserApprovalResponse,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function BrowserAuthenticationForm({
  approval,
  disabled,
  onRespond,
}: {
  approval: BrowserApproval;
  disabled: boolean;
  onRespond: (response: BrowserApprovalResponse) => Promise<void>;
}) {
  const [selectedOption, setSelectedOption] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const request = approval.request;

  if (request.type !== "browser_authentication") {
    return null;
  }

  const selected = request.options.find((option) => option.id === selectedOption);
  const fields = selected
    ? request.fields.filter((field) => selected.field_ids.includes(field.id))
    : request.options.length
      ? []
      : request.fields;
  const canSubmit =
    browserCredentialOriginSchema.safeParse(request.credential_origin).success &&
    (!request.options.length || Boolean(selected)) &&
    fields.every((field) => !field.required || Boolean(values[field.id])) &&
    (!fields.length || fields.some((field) => Boolean(values[field.id])));

  return (
    <form
      className="space-y-3"
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || !canSubmit) {
          return;
        }

        const response: BrowserApprovalResponse = {
          type: "browser_authentication",
          action: "submit",
          fields: fields
            .filter((field) => values[field.id])
            .map((field) => ({ field_id: field.id, value: values[field.id] })),
          ...(selectedOption ? { selected_option: selectedOption } : {}),
        };

        setValues({});
        void onRespond(response);
      }}
    >
      <p className="font-medium">
        Sign in to {request.credential_origin ?? "an unverified destination"}
      </p>
      <p className="text-muted-foreground">
        {request.reason ?? "The browser needs you to sign in."}
      </p>
      {request.options.length > 0 && (
        <label className="block space-y-1">
          <span>Sign-in method</span>
          <select
            value={selectedOption}
            disabled={disabled}
            className="w-full rounded-md border bg-background p-2"
            onChange={(event) => {
              setSelectedOption(event.target.value);
              setValues({});
            }}
          >
            <option value="">Choose a method</option>
            {request.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {fields.map((field) => (
        <label key={field.id} className="block space-y-1">
          <span>{field.label}</span>
          <Input
            type="password"
            autoComplete="off"
            required={field.required}
            maxLength={16_384}
            value={values[field.id] ?? ""}
            disabled={disabled}
            onChange={(event) =>
              setValues((current) => ({ ...current, [field.id]: event.target.value }))
            }
          />
        </label>
      ))}
      <p className="text-xs text-muted-foreground">
        Values go directly to this sign-in form and stay out of the conversation.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={disabled || !canSubmit}>
          Submit sign-in
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setValues({});
            void onRespond({ type: "browser_authentication", action: "cancel" });
          }}
        >
          Cancel sign-in
        </Button>
      </div>
    </form>
  );
}
