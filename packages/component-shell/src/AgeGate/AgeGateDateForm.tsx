import {
  Button,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import { AGE_CHECK_INFO_URL } from "@ngriffin_uk/polychat-library-client";
import { calendarDateFromParts, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { type FormEvent, useState } from "react";

import { type BirthDateParts, BirthDateFields } from "./BirthDateFields.js";

interface AgeGateDateFormProps {
  onConfirm: (birthDate: string) => void;
  onSkip: () => void;
  isConfirming: boolean;
  error: unknown;
}

export function AgeGateDateForm({ onConfirm, onSkip, isConfirming, error }: AgeGateDateFormProps) {
  const [parts, setParts] = useState<BirthDateParts>({ day: "", month: "", year: "" });
  const isComplete = parts.day !== "" && parts.month !== "" && parts.year.length === 4;
  const birthDate = isComplete
    ? calendarDateFromParts(Number(parts.year), Number(parts.month), Number(parts.day))
    : null;
  const message =
    isComplete && !birthDate
      ? "That date doesn't exist."
      : error
        ? getErrorMessage(error, "That didn't go through. Try again.")
        : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (birthDate) {
      onConfirm(birthDate);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Add your date of birth</DialogTitle>
        <DialogDescription>
          One quick check before your first message. We keep only whether you meet the minimum age,
          never the date itself, and you can&rsquo;t change it afterwards.{" "}
          <a
            href={AGE_CHECK_INFO_URL}
            target="_blank"
            rel="noreferrer"
            className={textLinkClassName({ tone: "accent" })}
          >
            Why we ask
          </a>
        </DialogDescription>
      </DialogHeader>

      <BirthDateFields
        value={parts}
        onChange={setParts}
        disabled={isConfirming}
        invalid={isComplete && !birthDate}
      />

      {message ? (
        <p
          role="alert"
          className="rounded-md border border-failure/40 bg-failure/10 px-3 py-2 text-sm text-failure"
        >
          {message}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSkip} disabled={isConfirming}>
          Skip
        </Button>
        <Button type="submit" variant="primary" isLoading={isConfirming} disabled={!birthDate}>
          Continue
        </Button>
      </DialogFooter>
    </form>
  );
}
