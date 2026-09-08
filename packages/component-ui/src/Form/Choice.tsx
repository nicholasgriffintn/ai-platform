import { ChevronsUpDown } from "lucide-react";

import { DropdownMenu, DropdownMenuItem } from "../DropdownMenu";

export function FormChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <DropdownMenu
        className="w-full"
        menuClassName="w-full"
        buttonProps={{
          type: "button",
          variant: "outline",
          fullWidth: true,
          "aria-label": label,
          className: "justify-between",
        }}
        trigger={
          <>
            {options.find((option) => option.value === value)?.label}
            <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
          </>
        }
      >
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenu>
    </div>
  );
}
