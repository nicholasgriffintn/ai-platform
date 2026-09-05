import { forwardRef, type ReactNode } from "react";

import { Link, type LinkRenderProps } from "./Link";
import { cn } from "./utils";

export type TextLinkTone = "muted" | "accent";

export type TextLinkSize = "xs" | "sm" | "md";

export interface TextLinkProps extends LinkRenderProps {
  tone?: TextLinkTone;
  size?: TextLinkSize;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
}

const toneStyles: Record<TextLinkTone, string> = {
  muted: "text-muted-foreground hover:text-foreground hover:border-border-strong",
  accent: "text-active-work hover:text-active-work/80 hover:border-active-work",
};

const sizeStyles: Record<TextLinkSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
};

export function textLinkClassName({
  tone = "muted",
  size = "sm",
  className,
}: Pick<TextLinkProps, "tone" | "size" | "className"> = {}): string {
  return cn(
    "group inline-flex max-w-full items-center gap-1 border-b border-transparent font-medium no-underline transition-colors hover:!no-underline",
    "focus-visible:outline-ring focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus:outline-none",
    sizeStyles[size],
    toneStyles[tone],
    className,
  );
}

export const TextLink = forwardRef<HTMLAnchorElement, TextLinkProps>(
  ({ tone = "muted", size = "sm", icon, trailingIcon, className, children, ...props }, ref) => (
    <Link ref={ref} className={textLinkClassName({ tone, size, className })} {...props}>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
      {trailingIcon ? (
        <span className="shrink-0 transition-transform group-hover:translate-x-0.5">
          {trailingIcon}
        </span>
      ) : null}
    </Link>
  ),
);

TextLink.displayName = "TextLink";
