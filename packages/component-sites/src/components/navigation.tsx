import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { SiteComponentProps } from "@ngriffin_uk/polychat-library-sites";

import { Action, HEADING_FONT, SiteLink } from "../ui.js";

export function Navbar({ brand, links, cta, sticky }: SiteComponentProps<"Navbar">) {
  return (
    <header
      className={cn(
        "w-full border-b bg-background/90 text-foreground backdrop-blur",
        sticky && "sticky top-0 z-40",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <SiteLink href="/" className={cn("text-lg font-semibold tracking-tight", HEADING_FONT)}>
          {brand}
        </SiteLink>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <SiteLink
              key={link.href + link.label}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </SiteLink>
          ))}
        </nav>
        {cta && (
          <Action href={cta.href} size="sm">
            {cta.label}
          </Action>
        )}
      </div>
    </header>
  );
}

export function Footer({ brand, tagline, columns, copyright }: SiteComponentProps<"Footer">) {
  return (
    <footer className="mt-auto w-full border-t bg-transparent">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-2">
            <span className={cn("text-lg font-semibold", HEADING_FONT)}>{brand}</span>
            {tagline && <p className="max-w-xs text-sm opacity-70">{tagline}</p>}
          </div>
          {columns && columns.length > 0 && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
              {columns.map((column) => (
                <div key={column.title} className="flex flex-col gap-3">
                  <span className="text-sm font-medium">{column.title}</span>
                  <ul className="flex flex-col gap-2">
                    {column.links.map((link) => (
                      <li key={link.href + link.label}>
                        <SiteLink
                          href={link.href}
                          className="text-sm opacity-70 transition-opacity hover:opacity-100"
                        >
                          {link.label}
                        </SiteLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        {copyright && <p className="text-xs opacity-70">{copyright}</p>}
      </div>
    </footer>
  );
}

export function Breadcrumbs({ items }: SiteComponentProps<"Breadcrumbs">) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <li key={item.href + item.label} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="text-foreground">
                  {item.label}
                </span>
              ) : (
                <SiteLink href={item.href} className="hover:text-foreground">
                  {item.label}
                </SiteLink>
              )}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
