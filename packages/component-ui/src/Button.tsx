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

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
  isLoading?: boolean;
  children?: ReactNode;
  className?: string;
}

export interface ButtonLinkProps extends LinkRenderProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm",
  primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
  secondary:
    "bg-off-white-highlight dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100",
  icon: "p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
  iconActive:
    "p-2 rounded-lg bg-off-white-highlight dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
  destructive: "bg-red-800 text-white hover:bg-red-900 shadow-sm",
  link: "text-blue-500 hover:text-blue-600 p-0",
  outline:
    "border border-zinc-300 bg-transparent hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800/70",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs rounded",
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-4 py-2 text-sm rounded-md",
  lg: "px-5 py-2.5 text-base rounded-md",
  icon: "",
};

export function buttonClassName({
  variant = "default",
  size = "md",
  fullWidth = false,
  className,
}: Pick<ButtonProps, "variant" | "size" | "fullWidth" | "className"> = {}): string {
  const buttonSize = variant.includes("icon") ? "icon" : size;

  return cn(
    "inline-flex cursor-pointer items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2",
    variantStyles[variant],
    buttonSize !== "icon" && sizeStyles[buttonSize],
    fullWidth && "w-full",
    "disabled:cursor-not-allowed disabled:opacity-70",
    className,
  );
}

function ButtonContent({ icon, children }: { icon?: ReactNode; children?: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {icon}
      {children}
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
        className={buttonClassName({ variant, size, fullWidth, className })}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            {children}
          </span>
        ) : (
          <ButtonContent icon={icon}>{children}</ButtonContent>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    { variant = "default", size = "md", icon, fullWidth = false, className, children, ...props },
    ref,
  ) => (
    <Link ref={ref} className={buttonClassName({ variant, size, fullWidth, className })} {...props}>
      <ButtonContent icon={icon}>{children}</ButtonContent>
    </Link>
  ),
);

ButtonLink.displayName = "ButtonLink";
