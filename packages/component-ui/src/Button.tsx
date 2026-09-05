import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

import { Link, type LinkRenderProps } from "./Link";
import { cn } from "./utils";

export type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "ghost"
  | "icon"
  | "iconActive"
  | "destructive"
  | "link"
  | "outline";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

export type ButtonCollapseBreakpoint = "sm" | "xl" | "container";

export type ButtonCollapse = boolean | ButtonCollapseBreakpoint;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
  collapseLabel?: ButtonCollapse;
  isLoading?: boolean;
  children?: ReactNode;
  className?: string;
}

export interface ButtonLinkProps extends LinkRenderProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
  collapseLabel?: ButtonCollapse;
}

const solidActionStyles =
  "bg-human-action text-human-action-foreground hover:bg-human-action/88 border-transparent shadow-sm";

const variantStyles: Record<ButtonVariant, string> = {
  default: solidActionStyles,
  primary: solidActionStyles,
  secondary: "bg-surface-elevated text-foreground hover:bg-selection border-transparent",
  outline:
    "border-border-strong bg-transparent text-foreground hover:bg-selection hover:text-foreground",
  ghost:
    "border-transparent bg-transparent text-muted-foreground hover:bg-selection hover:text-foreground",
  destructive: "bg-failure text-canvas hover:bg-failure/88 border-transparent shadow-sm",
  icon: "border-transparent bg-transparent text-muted-foreground hover:bg-selection hover:text-foreground",
  iconActive: "text-active-work hover:bg-selection border-transparent bg-transparent",
  link: "text-active-work hover:text-active-work/80 border-0 bg-transparent p-0 underline-offset-4 hover:underline",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "min-h-7 gap-1.5 px-2 py-1 text-xs",
  sm: "min-h-8 px-3 py-1.5 text-sm",
  md: "min-h-9 px-4 py-2 text-sm",
  lg: "min-h-10 px-5 py-2.5 text-base",
  icon: "min-h-9 min-w-9 p-2",
};

const iconSizeStyles: Record<ButtonSize, string> = {
  xs: "min-h-7 min-w-7 p-1",
  sm: "min-h-8 min-w-8 p-1.5",
  md: "min-h-9 min-w-9 p-2",
  lg: "min-h-10 min-w-10 p-2.5",
  icon: "min-h-9 min-w-9 p-2",
};

const collapsedSizeStyles: Record<ButtonCollapseBreakpoint, Record<ButtonSize, string>> = {
  container: {
    xs: "min-h-7 min-w-7 p-1 text-xs @min-[40rem]:min-w-0 @min-[40rem]:px-2 @min-[40rem]:py-1",
    sm: "min-h-8 min-w-8 p-1.5 text-sm @min-[40rem]:min-w-0 @min-[40rem]:px-3 @min-[40rem]:py-1.5",
    md: "min-h-9 min-w-9 p-2 text-sm @min-[40rem]:min-w-0 @min-[40rem]:px-4 @min-[40rem]:py-2",
    lg: "min-h-10 min-w-10 p-2.5 text-base @min-[40rem]:min-w-0 @min-[40rem]:px-5 @min-[40rem]:py-2.5",
    icon: "min-h-9 min-w-9 p-2",
  },
  sm: {
    xs: "min-h-7 min-w-7 p-1 text-xs sm:min-w-0 sm:px-2 sm:py-1",
    sm: "min-h-8 min-w-8 p-1.5 text-sm sm:min-w-0 sm:px-3 sm:py-1.5",
    md: "min-h-9 min-w-9 p-2 text-sm sm:min-w-0 sm:px-4 sm:py-2",
    lg: "min-h-10 min-w-10 p-2.5 text-base sm:min-w-0 sm:px-5 sm:py-2.5",
    icon: "min-h-9 min-w-9 p-2",
  },
  xl: {
    xs: "min-h-7 min-w-7 p-1 text-xs xl:min-w-0 xl:px-2 xl:py-1",
    sm: "min-h-8 min-w-8 p-1.5 text-sm xl:min-w-0 xl:px-3 xl:py-1.5",
    md: "min-h-9 min-w-9 p-2 text-sm xl:min-w-0 xl:px-4 xl:py-2",
    lg: "min-h-10 min-w-10 p-2.5 text-base xl:min-w-0 xl:px-5 xl:py-2.5",
    icon: "min-h-9 min-w-9 p-2",
  },
};

const collapsedLabelStyles: Record<ButtonCollapseBreakpoint, string> = {
  container: "hidden @min-[40rem]:inline",
  sm: "hidden sm:inline",
  xl: "hidden xl:inline",
};

function resolveCollapse(collapseLabel: ButtonCollapse): ButtonCollapseBreakpoint | null {
  if (!collapseLabel) {
    return null;
  }

  return collapseLabel === true ? "sm" : collapseLabel;
}

function isIconShaped(variant: ButtonVariant, size: ButtonSize): boolean {
  return variant === "icon" || variant === "iconActive" || size === "icon";
}

function resolveSizeStyles(
  variant: ButtonVariant,
  size: ButtonSize,
  collapse: ButtonCollapseBreakpoint | null,
): string {
  if (variant === "link") {
    return "";
  }

  if (isIconShaped(variant, size)) {
    return iconSizeStyles[size];
  }

  return collapse ? collapsedSizeStyles[collapse][size] : sizeStyles[size];
}

export function buttonClassName({
  variant = "default",
  size = "md",
  fullWidth = false,
  collapseLabel = false,
  className,
}: Pick<
  ButtonProps,
  "variant" | "size" | "fullWidth" | "collapseLabel" | "className"
> = {}): string {
  return cn(
    "polychat-motion-micro inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-md border border-solid font-medium whitespace-nowrap transition-colors",
    "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus:outline-none",
    resolveSizeStyles(variant, size, resolveCollapse(collapseLabel)),
    variantStyles[variant],
    fullWidth && "w-full",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
    className,
  );
}

function ButtonLabel({
  collapseLabel = false,
  children,
}: {
  collapseLabel?: ButtonCollapse;
  children?: ReactNode;
}) {
  const collapse = resolveCollapse(collapseLabel);

  if (!collapse || !children) {
    return <>{children}</>;
  }

  return <span className={collapsedLabelStyles[collapse]}>{children}</span>;
}

function ButtonContent({
  icon,
  collapseLabel = false,
  children,
}: {
  icon?: ReactNode;
  collapseLabel?: ButtonCollapse;
  children?: ReactNode;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {icon}
      <ButtonLabel collapseLabel={collapseLabel}>{children}</ButtonLabel>
    </span>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "default",
      size = "md",
      icon,
      fullWidth = false,
      collapseLabel = false,
      isLoading = false,
      className = "",
      children,
      disabled,
      type = "button",
      "aria-busy": ariaBusy,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading ? true : ariaBusy}
        className={buttonClassName({ variant, size, fullWidth, collapseLabel, className })}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            <ButtonLabel collapseLabel={collapseLabel}>{children}</ButtonLabel>
          </span>
        ) : (
          <ButtonContent icon={icon} collapseLabel={collapseLabel}>
            {children}
          </ButtonContent>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      variant = "default",
      size = "md",
      icon,
      fullWidth = false,
      collapseLabel = false,
      className,
      children,
      ...props
    },
    ref,
  ) => (
    <Link
      ref={ref}
      className={buttonClassName({
        variant,
        size,
        fullWidth,
        collapseLabel,
        className: cn(
          variant === "link" ? "no-underline" : "no-underline hover:!no-underline",
          className,
        ),
      })}
      {...props}
    >
      <ButtonContent icon={icon} collapseLabel={collapseLabel}>
        {children}
      </ButtonContent>
    </Link>
  ),
);

ButtonLink.displayName = "ButtonLink";
