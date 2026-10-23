import { Link } from "@ngriffin_uk/polychat-component-ui";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface FilesCrumb {
  label: string;
  href?: string;
}

export function FilesBreadcrumb({
  basePath,
  trail,
  actions,
}: {
  basePath: string;
  trail: FilesCrumb[];
  actions?: ReactNode;
}) {
  const crumbs: FilesCrumb[] = [{ label: "Files", href: basePath }, ...trail];

  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          {crumbs.map((crumb, index) => (
            <li key={crumb.href ?? crumb.label} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
              ) : null}
              {crumb.href && index < crumbs.length - 1 ? (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground no-underline hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate text-foreground">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}
