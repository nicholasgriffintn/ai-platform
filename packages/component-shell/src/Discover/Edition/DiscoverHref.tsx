import { isHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import type { ReactNode } from "react";
import { Link } from "react-router";

export function DiscoverHref({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return isHttpUrl(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}
