import type { ReactNode } from "react";

export interface ProseProps {
  children: ReactNode;
  className?: string;
}

export function Prose({ children, className }: ProseProps) {
  return (
    <div className={["prose dark:prose-invert max-w-[840px]", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

export interface FaviconProps {
  url: string;
  className?: string;
  resolveIconUrl?: (hostname: string) => string;
}

export function Favicon({ url, className, resolveIconUrl = defaultIconUrl }: FaviconProps) {
  const hostname = getHostname(url);

  return (
    <img
      src={resolveIconUrl(hostname)}
      alt=""
      aria-hidden="true"
      className={["polychat-content-favicon", className].filter(Boolean).join(" ")}
      decoding="async"
      loading="lazy"
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
    />
  );
}

function getHostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    try {
      return new URL(`https://${value}`).hostname;
    } catch {
      return value;
    }
  }
}

function defaultIconUrl(hostname: string): string {
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`;
}
