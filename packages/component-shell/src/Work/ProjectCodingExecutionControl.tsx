import { InlineSettingSelect } from "@ngriffin_uk/polychat-component-conversation";
import { Laptop2 } from "lucide-react";

export function ProjectCodingExecutionControl({
  value,
  options,
  isDisabled,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  isDisabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <InlineSettingSelect<string>
      id="project-coding-execution"
      label="Execution environment"
      icon={<Laptop2 className="h-4 w-4" />}
      value={value}
      displayLabel={options.find((option) => option.value === value)?.label ?? "Polychat managed"}
      options={options}
      isDisabled={isDisabled}
      onChange={(next) => {
        if (next) {
          onChange(next);
        }
      }}
    />
  );
}
