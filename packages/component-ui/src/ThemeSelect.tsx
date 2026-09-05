import { FormSelect } from "./Form/Select";
import { getThemePreferenceOptions, isThemePreference, type ThemePreference } from "./theme";

export interface ThemeSelectProps {
  value: ThemePreference;
  onChange: (preference: ThemePreference) => void;
  className?: string;
}

const OPTIONS = getThemePreferenceOptions().map((option) => ({
  value: option.value,
  label: option.label,
}));

export function ThemeSelect({ value, onChange, className }: ThemeSelectProps) {
  return (
    <FormSelect
      label="Theme"
      options={OPTIONS}
      value={value}
      className={className}
      onChange={(event) => {
        const next = event.target.value;

        if (isThemePreference(next)) {
          onChange(next);
        }
      }}
    />
  );
}
