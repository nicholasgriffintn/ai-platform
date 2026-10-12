import { Button, FormInput, PageStatus } from "@ngriffin_uk/polychat-component-ui";
import {
  useAuthStatus,
  useDecideDeviceAuthorization,
  useDeviceAuthorization,
} from "@ngriffin_uk/polychat-library-react";
import { formatDeviceUserCode, normaliseDeviceUserCode } from "@ngriffin_uk/polychat-schemas";
import { Loader2, MonitorSmartphone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";

import { PageShell } from "../Shell/PageShell.js";
import { SignInEmptyState } from "./SignInEmptyState.js";

function DeviceCodeForm({
  initialCode,
  onSubmit,
}: {
  initialCode: string;
  onSubmit: (userCode: string) => void;
}) {
  const [value, setValue] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userCode = normaliseDeviceUserCode(value);

    if (!userCode) {
      setError("Codes are eight letters, like BCDF-GHJK. Check your device and try again.");

      return;
    }

    setError(null);
    onSubmit(userCode);
  };

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <FormInput
        id="device-user-code"
        label="Code shown on your device"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="font-mono tracking-widest uppercase"
        aria-invalid={error ? true : undefined}
        description={error ?? undefined}
      />
      <Button type="submit" variant="primary">
        Continue
      </Button>
    </form>
  );
}

function DeviceDecision({ userCode, onReset }: { userCode: string; onReset: () => void }) {
  const authorization = useDeviceAuthorization(userCode);
  const decide = useDecideDeviceAuthorization(userCode);

  if (decide.data) {
    return (
      <PageStatus
        title={decide.data.status === "approved" ? "Device signed in" : "Sign-in refused"}
        message={
          decide.data.status === "approved"
            ? "Return to your device. It now has its own API key, which you can revoke from Profile at any time."
            : "Nothing was shared with the device. You can close this page."
        }
        className="h-auto min-h-[240px]"
      />
    );
  }

  if (authorization.isLoading) {
    return (
      <PageStatus
        icon={<Loader2 size={32} className="animate-spin text-active-work" />}
        message="Checking the code..."
        className="h-auto min-h-[240px]"
      />
    );
  }

  if (!authorization.data) {
    return (
      <PageStatus
        title="Code not recognised"
        message={authorization.error?.message ?? "This code has expired or was already used."}
        className="h-auto min-h-[240px]"
      >
        <Button variant="secondary" onClick={onReset}>
          Enter another code
        </Button>
      </PageStatus>
    );
  }

  return (
    <PageStatus
      icon={<MonitorSmartphone size={32} />}
      title={`Sign in ${authorization.data.clientName}?`}
      message={`Only approve this if you started sign-in on that device and it shows ${authorization.data.userCode}. It will get an API key that can act as you until you revoke it.`}
      className="h-auto min-h-[240px]"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => decide.mutate("deny")}
            disabled={decide.isPending}
          >
            Deny
          </Button>
          <Button
            variant="primary"
            onClick={() => decide.mutate("approve")}
            isLoading={decide.isPending}
          >
            Approve
          </Button>
        </div>
        {decide.error ? (
          <p className="text-sm text-failure" role="alert">
            {decide.error.message}
          </p>
        ) : null}
      </div>
    </PageStatus>
  );
}

export function DeviceApprovalPage() {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const [searchParams] = useSearchParams();
  const linkedCode = normaliseDeviceUserCode(searchParams.get("user_code") ?? "");
  const [userCode, setUserCode] = useState<string | null>(linkedCode);

  return (
    <PageShell title="Connect a device" displayNavBar={false} className="max-w-2xl">
      {isLoading ? (
        <PageStatus
          icon={<Loader2 size={32} className="animate-spin text-active-work" />}
          message="Checking your sign-in..."
          className="h-auto min-h-[240px]"
        />
      ) : !isAuthenticated ? (
        <SignInEmptyState
          title="Sign in to connect a device"
          message="Sign in first, then approve the code your device is showing."
          className="h-auto min-h-[240px]"
        />
      ) : userCode ? (
        <DeviceDecision userCode={userCode} onReset={() => setUserCode(null)} />
      ) : (
        <DeviceCodeForm
          initialCode={linkedCode ? formatDeviceUserCode(linkedCode) : ""}
          onSubmit={setUserCode}
        />
      )}
    </PageShell>
  );
}
