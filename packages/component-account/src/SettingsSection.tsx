import { Card, cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export interface SettingsSectionProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  plain?: boolean;
}

export function SettingsSection({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  plain = false,
}: SettingsSectionProps) {
  const header =
    title || description || actions ? (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {title ? <SettingsSectionTitle>{title}</SettingsSectionTitle> : null}
          {description ? (
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    ) : null;

  if (plain) {
    return (
      <section className={cn("space-y-6", className)}>
        {header}
        <div className={contentClassName}>{children}</div>
      </section>
    );
  }

  return (
    <Card className={className}>
      {header ? <div className="border-border border-b px-6 pb-4">{header}</div> : null}
      <div className={cn("px-6", contentClassName)}>{children}</div>
    </Card>
  );
}

export function SettingsSectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h3 className={cn("text-foreground text-lg font-bold", className)}>{children}</h3>;
}

export function SettingsFieldLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h3 className={cn("text-muted-foreground text-sm font-medium", className)}>{children}</h3>;
}

export function SettingsGroupLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-muted-foreground text-xs font-semibold tracking-wide uppercase",
        className,
      )}
    >
      {children}
    </h2>
  );
}
