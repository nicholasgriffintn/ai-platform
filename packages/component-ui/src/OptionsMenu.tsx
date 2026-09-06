import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

import { cn } from "./utils";

const surfaceClassName =
  "border-border bg-popover text-popover-foreground z-[70] min-w-44 rounded-md border p-1 text-xs shadow-[var(--polychat-elevated-shadow)]";

const rowClassName =
  "text-popover-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex w-full cursor-pointer select-none items-center rounded px-2 py-1.5 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

const SHORTCUT_KEY_PATTERN = /^[a-z0-9]$/;

function findShortcutItem(
  menu: HTMLElement,
  event: KeyboardEvent<HTMLElement>,
): HTMLElement | null {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }

  const key = event.key.toLowerCase();

  if (!SHORTCUT_KEY_PATTERN.test(key)) {
    return null;
  }

  if (!(event.target instanceof Node) || !menu.contains(event.target)) {
    return null;
  }

  return menu.querySelector<HTMLElement>(`[data-shortcut="${key}"]:not([data-disabled])`);
}

function activateShortcut(event: KeyboardEvent<HTMLDivElement>) {
  const item = findShortcutItem(event.currentTarget, event);

  if (!item) {
    return;
  }

  event.preventDefault();
  item.click();
}

export interface OptionsMenuProps {
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  alignOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  className?: string;
  contentStyle?: CSSProperties;
  children: ReactNode;
  modal?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  preserveTriggerFocus?: boolean;
  triggerWrapper?: (trigger: ReactNode, open?: boolean) => ReactNode;
  triggerWrapperActive?: boolean;
}

export function OptionsMenu({
  trigger,
  align = "start",
  alignOffset,
  side,
  sideOffset = 6,
  className,
  contentStyle,
  children,
  modal,
  onOpenChange,
  open,
  preserveTriggerFocus = false,
  triggerWrapper,
  triggerWrapperActive,
}: OptionsMenuProps) {
  const menuTrigger = (
    <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
  );

  return (
    <DropdownMenuPrimitive.Root modal={modal} onOpenChange={onOpenChange} open={open}>
      {triggerWrapper ? triggerWrapper(menuTrigger, triggerWrapperActive ?? open) : menuTrigger}
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          alignOffset={alignOffset}
          side={side}
          sideOffset={sideOffset}
          collisionPadding={8}
          className={cn(surfaceClassName, className)}
          style={contentStyle}
          onCloseAutoFocus={preserveTriggerFocus ? (event) => event.preventDefault() : undefined}
          onKeyDown={activateShortcut}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

export interface OptionsMenuOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface OptionsMenuRadioGroupProps<TValue extends string> {
  value: TValue;
  options: readonly OptionsMenuOption<TValue>[];
  onChange: (value: TValue) => void;
}

export function OptionsMenuRadioGroup<TValue extends string>({
  value,
  options,
  onChange,
}: OptionsMenuRadioGroupProps<TValue>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      value={value}
      onValueChange={(nextValue) => {
        const nextOption = options.find((option) => option.value === nextValue);

        if (nextOption) {
          onChange(nextOption.value);
        }
      }}
    >
      {options.map((option) => (
        <DropdownMenuPrimitive.RadioItem
          key={option.value}
          value={option.value}
          className={cn(rowClassName, "justify-between gap-4")}
        >
          <span className="truncate">{option.label}</span>
          <DropdownMenuPrimitive.ItemIndicator className="text-active-work shrink-0">
            <Check size={13} aria-hidden="true" />
          </DropdownMenuPrimitive.ItemIndicator>
        </DropdownMenuPrimitive.RadioItem>
      ))}
    </DropdownMenuPrimitive.RadioGroup>
  );
}

export interface OptionsMenuSectionProps<
  TValue extends string,
> extends OptionsMenuRadioGroupProps<TValue> {
  label: string;
}

export function OptionsMenuSection<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: OptionsMenuSectionProps<TValue>) {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenuPrimitive.Sub>
      <DropdownMenuPrimitive.SubTrigger className={cn(rowClassName, "justify-between gap-4")}>
        <span className="truncate">{label}</span>
        <span className="text-muted-foreground flex shrink-0 items-center gap-1">
          {selected?.label}
          <ChevronRight size={13} aria-hidden="true" />
        </span>
      </DropdownMenuPrimitive.SubTrigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.SubContent
          sideOffset={2}
          alignOffset={-5}
          collisionPadding={8}
          className={surfaceClassName}
        >
          <OptionsMenuRadioGroup value={value} options={options} onChange={onChange} />
        </DropdownMenuPrimitive.SubContent>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Sub>
  );
}

export interface OptionsMenuSubmenuProps {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function OptionsMenuSubmenu({
  trigger,
  children,
  className,
  contentClassName,
}: OptionsMenuSubmenuProps) {
  return (
    <DropdownMenuPrimitive.Sub>
      <DropdownMenuPrimitive.SubTrigger
        className={cn(rowClassName, "justify-between gap-4", className)}
      >
        <span className="min-w-0 flex-1">{trigger}</span>
        <ChevronRight size={13} className="shrink-0" aria-hidden="true" />
      </DropdownMenuPrimitive.SubTrigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.SubContent
          sideOffset={2}
          alignOffset={-5}
          collisionPadding={8}
          className={cn(surfaceClassName, contentClassName)}
        >
          {children}
        </DropdownMenuPrimitive.SubContent>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Sub>
  );
}

export function OptionsMenuSeparator() {
  return <DropdownMenuPrimitive.Separator className="bg-border my-1 h-px" />;
}

export interface OptionsMenuActionProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  keepOpen?: boolean;
  onSelect: () => void;
  shortcut?: string;
}

export function OptionsMenuAction({
  children,
  className,
  disabled,
  keepOpen = false,
  onSelect,
  shortcut,
}: OptionsMenuActionProps) {
  return (
    <DropdownMenuPrimitive.Item
      disabled={disabled}
      data-shortcut={shortcut?.toLowerCase()}
      onSelect={(event) => {
        if (keepOpen) {
          event.preventDefault();
        }

        onSelect();
      }}
      className={cn(rowClassName, "justify-start gap-4", className)}
    >
      {children}
      {shortcut && (
        <kbd
          className="text-muted-foreground ml-auto shrink-0 font-sans text-[11px] font-medium uppercase"
          aria-hidden="true"
        >
          {shortcut}
        </kbd>
      )}
    </DropdownMenuPrimitive.Item>
  );
}
