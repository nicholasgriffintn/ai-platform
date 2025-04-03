import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "~/lib/utils";

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
      ...props
    },
    ref,
  ) => {
    const variantStyles: Record<ButtonVariant, string> = {
      default: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm",
      primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
      secondary:
        "bg-off-white-highlight dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600",
      ghost:
        "hover:bg-off-white-highlight dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400",
      icon: "p-2 rounded-lg hover:bg-off-white-highlight dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-500",
      iconActive:
        "p-2 rounded-lg bg-off-white-highlight dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
      destructive: "bg-red-800 text-white hover:bg-red-900 shadow-sm",
      link: "text-blue-500 hover:text-blue-600 p-0",
      outline: "border border-zinc-300 dark:border-zinc-700",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      xs: "px-2 py-1 text-xs rounded",
      sm: "px-3 py-1.5 text-sm rounded-md",
      md: "px-4 py-2 text-sm rounded-md",
      lg: "px-5 py-2.5 text-base rounded-md",
      icon: "",
    };

    const baseStyles =
      "cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2";
    const disabledStyles = "disabled:opacity-70 disabled:cursor-not-allowed";

    const buttonSize = variant.includes("icon") ? "icon" : size;

    const buttonClasses = cn(
      baseStyles,
      variantStyles[variant],
      buttonSize !== "icon" && sizeStyles[buttonSize],
      fullWidth && "w-full",
      disabledStyles,
      className,
    );

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={buttonClasses}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {children && <span className="ml-2">{children}</span>}
          </div>
        ) : (
          <div className="flex items-center justify-center">
            {icon && <span className={children ? "mr-2" : ""}>{icon}</span>}
            {children}
          </div>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
