import { Button, FormInput } from "@ngriffin_uk/polychat-component-ui";
import { oidcConnectionParamsSchema } from "@ngriffin_uk/polychat-schemas";
import { useState, type FormEvent } from "react";

export function EnterpriseSignInForm({
  onSignIn,
  isPending = false,
}: {
  onSignIn: (connectionId: string) => void;
  isPending?: boolean;
}) {
  const [connectionId, setConnectionId] = useState("");
  const [error, setError] = useState<string>();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = oidcConnectionParamsSchema.safeParse({ connectionId: connectionId.trim() });

    if (!parsed.success) {
      setError("Enter the connection ID supplied by your workspace owner");

      return;
    }

    setError(undefined);
    onSignIn(parsed.data.connectionId);
  };

  return (
    <details className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer text-sm font-medium">Sign in through your company</summary>
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <FormInput
          label="Identity connection ID"
          value={connectionId}
          required
          disabled={isPending}
          onChange={(event) => setConnectionId(event.target.value)}
          description="Ask your workspace owner for their connection ID or sign-in link."
        />
        {error ? (
          <p role="alert" className="text-sm text-failure">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" isLoading={isPending}>
          Continue with company sign-in
        </Button>
      </form>
    </details>
  );
}
