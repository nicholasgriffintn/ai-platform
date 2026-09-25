import { type ReactNode, useCallback, useMemo, useState } from "react";

import { cn } from "../utils";
import { pageShellContentClassName } from "./PageShellContent";
import type { PageShellHeaderDefinition } from "./PageShellHeader";

interface HeaderRegistration {
  owner: symbol;
  definition: PageShellHeaderDefinition;
}

export function usePageShellHeaderRegistry() {
  const [registrations, setRegistrations] = useState<HeaderRegistration[]>([]);

  const register = useCallback((owner: symbol, definition: PageShellHeaderDefinition) => {
    setRegistrations((current) => {
      const existingIndex = current.findIndex((registration) => registration.owner === owner);

      if (existingIndex === -1) {
        return [...current, { owner, definition }];
      }

      return current.map((registration, index) =>
        index === existingIndex ? { owner, definition } : registration,
      );
    });
  }, []);

  const unregister = useCallback((owner: symbol) => {
    setRegistrations((current) => current.filter((registration) => registration.owner !== owner));
  }, []);

  const headerContext = useMemo(() => ({ register, unregister }), [register, unregister]);

  return { headerContext, registeredHeader: registrations.at(-1)?.definition };
}

export interface PageShellFrameProps {
  children: ReactNode;
  className?: string;
  fullBleed?: boolean;
  header?: ReactNode;
  notification?: ReactNode;
}

export function PageShellFrame({
  children,
  className,
  fullBleed = false,
  header,
  notification,
}: PageShellFrameProps) {
  return (
    <>
      {notification}
      {fullBleed ? (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {header}
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      ) : header ? (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {header}
          <div data-header-scroll-source className="min-h-0 w-full flex-1 overflow-y-auto">
            <div className={cn(pageShellContentClassName, className)}>{children}</div>
          </div>
        </div>
      ) : (
        <div className={cn(pageShellContentClassName, "overflow-y-auto", className)}>
          {children}
        </div>
      )}
    </>
  );
}
