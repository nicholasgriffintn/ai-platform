import { FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { keepDigits, listMonthNames } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export interface BirthDateParts {
  day: string;
  month: string;
  year: string;
}

interface BirthDateFieldsProps {
  value: BirthDateParts;
  onChange: (value: BirthDateParts) => void;
  disabled?: boolean;
  invalid?: boolean;
}

export function BirthDateFields({ value, onChange, disabled, invalid }: BirthDateFieldsProps) {
  const [monthOptions] = useState(() =>
    listMonthNames().map((label, index) => ({ value: String(index + 1), label })),
  );

  return (
    <fieldset className="grid grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] gap-2" disabled={disabled}>
      <legend className="sr-only">Date of birth</legend>
      <FormInput
        label="Day"
        inputMode="numeric"
        autoComplete="bday-day"
        placeholder="DD"
        value={value.day}
        onChange={(event) => onChange({ ...value, day: keepDigits(event.target.value, 2) })}
        aria-invalid={invalid || undefined}
      />
      <FormSelect
        label="Month"
        options={monthOptions}
        value={value.month}
        onValueChange={(month) => onChange({ ...value, month })}
        placeholder="Month"
        disabled={disabled}
        portal
      />
      <FormInput
        label="Year"
        inputMode="numeric"
        autoComplete="bday-year"
        placeholder="YYYY"
        value={value.year}
        onChange={(event) => onChange({ ...value, year: keepDigits(event.target.value, 4) })}
        aria-invalid={invalid || undefined}
      />
    </fieldset>
  );
}
