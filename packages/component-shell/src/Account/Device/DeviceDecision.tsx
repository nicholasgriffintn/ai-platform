import { Button, ButtonLink } from "@ngriffin_uk/polychat-component-ui";
import {
  useDecideDeviceAuthorisation,
  useDeviceAuthorisation,
} from "@ngriffin_uk/polychat-library-react";
import type { DeviceAuthorisation } from "@ngriffin_uk/polychat-schemas";
import { readDeviceUserCodeCharacters } from "@ngriffin_uk/polychat-schemas";
import { formatDuration } from "@ngriffin_uk/polychat-utility-core";
import { useSecondsUntil } from "@ngriffin_uk/polychat-utility-react";
import { Clock3, Gauge, KeyRound, Loader2, Undo2, type LucideIcon } from "lucide-react";

import { DeviceCodeCells } from "./DeviceCodeInput.js";
import { DevicePairingCard } from "./DevicePairingCard.js";

const API_KEYS_HREF = "/profile?tab=api-keys";

const GRANTS: Array<{ icon: LucideIcon; text: string }> = [
  { icon: KeyRound, text: "Its own API key that can do anything you can." },
  { icon: Gauge, text: "Usage counts against your plan, like your own chats." },
  { icon: Undo2, text: "Revoke it from Profile whenever you like." },
];

function ExpiredCard({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <DevicePairingCard
      state="refused"
      eyebrow="Code not recognised"
      title="That code has flown the nest"
      description={message}
    >
      <Button variant="secondary" size="lg" fullWidth onClick={onReset}>
        Enter another code
      </Button>
    </DevicePairingCard>
  );
}

function PendingRequest({
  authorisation,
  onReset,
}: {
  authorisation: DeviceAuthorisation;
  onReset: () => void;
}) {
  const decide = useDecideDeviceAuthorisation(authorisation.userCode);
  const secondsLeft = useSecondsUntil(authorisation.expiresAt);
  const { clientName } = authorisation;

  if (decide.data?.status === "approved") {
    return (
      <DevicePairingCard
        state="linked"
        eyebrow="Connected"
        title={`${clientName} is signed in`}
        description="Head back to your device, it has already collected its key. You will find it under API keys in Profile."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink href={API_KEYS_HREF} variant="secondary" size="lg" fullWidth>
            Manage API keys
          </ButtonLink>
          <Button variant="ghost" size="lg" fullWidth onClick={onReset}>
            Connect another
          </Button>
        </div>
      </DevicePairingCard>
    );
  }

  if (decide.data?.status === "denied") {
    return (
      <DevicePairingCard
        state="refused"
        eyebrow="Refused"
        title={`${clientName} was turned away`}
        description="Nothing was shared with the device. You can close this page."
      >
        <Button variant="ghost" size="lg" fullWidth onClick={onReset}>
          Enter another code
        </Button>
      </DevicePairingCard>
    );
  }

  if (secondsLeft === 0) {
    return (
      <ExpiredCard
        message="This request expired before anyone decided. Start sign-in again on your device for a fresh code."
        onReset={onReset}
      />
    );
  }

  return (
    <DevicePairingCard
      state="waiting"
      eyebrow="Sign-in request"
      title={
        <>
          Connect <span className="text-active-work">{clientName}</span>?
        </>
      }
      description="Only approve this if you started sign-in yourself and the device shows exactly this code."
    >
      <div className="flex flex-col items-center gap-2">
        <DeviceCodeCells characters={readDeviceUserCodeCharacters(authorisation.userCode)} />
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          Expires in {formatDuration(secondsLeft)}
        </p>
      </div>

      <ul className="flex flex-col gap-2.5 rounded-xl bg-canvas px-4 py-3.5">
        {GRANTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-2.5 text-sm text-muted-foreground">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => decide.mutate("deny")}
            disabled={decide.isPending}
          >
            Deny
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => decide.mutate("approve")}
            isLoading={decide.isPending}
            disabled={decide.isPending}
          >
            Approve
          </Button>
        </div>
        {decide.error ? (
          <p className="text-center text-sm text-failure" role="alert">
            {decide.error.message}
          </p>
        ) : null}
      </div>
    </DevicePairingCard>
  );
}

export function DeviceDecision({ userCode, onReset }: { userCode: string; onReset: () => void }) {
  const authorisation = useDeviceAuthorisation(userCode);

  if (authorisation.isLoading) {
    return (
      <DevicePairingCard state="waiting" eyebrow="Connect a device" title="Checking the code">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-active-work" aria-hidden="true" />
      </DevicePairingCard>
    );
  }

  if (!authorisation.data) {
    return (
      <ExpiredCard
        message={
          authorisation.error?.message ??
          "This code has expired or was already used. Start sign-in again on your device."
        }
        onReset={onReset}
      />
    );
  }

  return <PendingRequest authorisation={authorisation.data} onReset={onReset} />;
}
