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

export type ButtonCollapseBreakpoint = "sm" | "xl";

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

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "border-transparent bg-zinc-900 text-white shadow-sm hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
  primary:
    "border-transparent bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400",
  secondary:
    "border-transparent bg-off-white-highlight text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600",
  outline:
    "border-zinc-300 bg-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  ghost:
    "border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  destructive:
    "border-transparent bg-red-800 text-white shadow-sm hover:bg-red-900 dark:bg-red-800 dark:hover:bg-red-700",
  icon: "border-transparent bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  iconActive:
    "border-transparent bg-off-white-highlight text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  link: "border-0 bg-transparent p-0 text-blue-600 underline-offset-4 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300",
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
    "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-md border border-solid font-medium whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 focus:outline-none",
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
