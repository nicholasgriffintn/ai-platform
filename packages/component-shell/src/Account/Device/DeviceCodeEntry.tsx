import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { CLI_LOGIN_COMMAND } from "@ngriffin_uk/polychat-library-client";
import { DEVICE_USER_CODE_LENGTH, normaliseDeviceUserCode } from "@ngriffin_uk/polychat-schemas";
import { useState, type FormEvent } from "react";

import { DeviceCodeInput } from "./DeviceCodeInput.js";
import { DevicePairingCard } from "./DevicePairingCard.js";

const INPUT_ID = "device-user-code";
const HINT_ID = "device-user-code-hint";

const STEPS = [
  { title: "Start sign-in on the device", detail: CLI_LOGIN_COMMAND },
  { title: "Type the code it shows", detail: "Eight letters, no vowels, so no O to mistake for 0" },
  { title: "Check the name and approve", detail: "The device collects its key on its own" },
];

function PairingSteps() {
  return (
    <ol className="flex flex-col gap-3 rounded-2xl border border-border px-5 py-4">
      {STEPS.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-active-work/12 font-mono text-[0.6875rem] font-medium text-active-work">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{step.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {index === 0 ? <code className="font-mono">{step.detail}</code> : step.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DeviceCodeEntry({ onSubmit }: { onSubmit: (userCode: string) => void }) {
  const [characters, setCharacters] = useState("");
  const complete = characters.length === DEVICE_USER_CODE_LENGTH;
  const invalid = complete && !normaliseDeviceUserCode(characters);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userCode = normaliseDeviceUserCode(characters);

    if (userCode) {
      onSubmit(userCode);
    }
  };

  return (
    <DevicePairingCard
      state="waiting"
      eyebrow="Connect a device"
      title="Enter the code from your device"
      description="A CLI or gateway asked to sign in as you. Match its code here and you decide what happens next."
      footer={<PairingSteps />}
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <label htmlFor={INPUT_ID} className="sr-only">
          Code shown on your device
        </label>
        <DeviceCodeInput
          id={INPUT_ID}
          value={characters}
          onChange={setCharacters}
          invalid={invalid}
          describedBy={HINT_ID}
        />
        <p
          id={HINT_ID}
          role={invalid ? "alert" : undefined}
          className={cn("text-center text-sm", invalid ? "text-failure" : "text-muted-foreground")}
        >
          {invalid
            ? "Codes only use consonants, and never Y. Check the letters against your device."
            : "Paste it whole or type it in. The dash is optional."}
        </p>
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={!complete || invalid}>
          Continue
        </Button>
      </form>
    </DevicePairingCard>
  );
}
