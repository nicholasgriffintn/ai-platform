import { FormSelect } from "@ngriffin_uk/polychat-component-ui";

export interface SourceKindOption {
  value: string;
  label: string;
}

export interface SourceKindFilterProps {
  kindOptions: SourceKindOption[];
  kind: string;
  onKindChange: (kind: string) => void;
}

export function SourceKindFilter({ kindOptions, kind, onKindChange }: SourceKindFilterProps) {
  return (
    <FormSelect
      aria-label="Filter sources by type"
      fullWidth={false}
      value={kind}
      onChange={(event) => onKindChange(event.target.value)}
      options={kindOptions}
    />
  );
}
