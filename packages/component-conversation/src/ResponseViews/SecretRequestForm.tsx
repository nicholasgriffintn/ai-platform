import { Button, Input } from "@ngriffin_uk/polychat-component-ui";
import { SECRET_VALUE_MAX_LENGTH, type SecretRequestViewData } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function SecretRequestForm({
  request,
  disabled,
  onSubmit,
  onDecline,
}: {
  request: SecretRequestViewData;
  disabled: boolean;
  onSubmit: (value: string) => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      className="space-y-3"
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || !value) {
          return;
        }

        const submitted = value;

        setValue("");
        void onSubmit(submitted);
      }}
    >
      <p className="font-medium">Provide {request.label}</p>
      <p className="text-muted-foreground">{request.purpose}</p>
      <p className="text-xs text-muted-foreground">
        It can only be sent to{" "}
        <span className="font-medium text-foreground">{request.destination}</span>.
      </p>
      <label className="block space-y-1">
        <span>{request.label}</span>
        <Input
          type="password"
          autoComplete="off"
          required
          maxLength={SECRET_VALUE_MAX_LENGTH}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        The value is stored encrypted and stays out of the conversation. The assistant gets a
        reference that works once, in this conversation, for 24 hours.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={disabled || !value}>
          Provide securely
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setValue("");
            void onDecline();
          }}
        >
          Decline
        </Button>
      </div>
    </form>
  );
}
