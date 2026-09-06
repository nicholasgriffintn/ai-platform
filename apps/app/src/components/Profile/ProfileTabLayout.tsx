import { PageShell } from "@ngriffin_uk/polychat-component-shell";
import type { ComponentProps, ReactNode } from "react";
type ProfileTabHeaderProps = ComponentProps<typeof PageShell.Header>;

export interface ProfileTabProps {
  title: ProfileTabHeaderProps["title"];
  actions?: ProfileTabHeaderProps["actions"];
  actionContent?: ProfileTabHeaderProps["actionContent"];
  description?: ReactNode;
  children: ReactNode;
}

export function ProfileTab({
  title,
  actions,
  actionContent,
  description,
  children,
}: ProfileTabProps) {
  return (
    <div className="space-y-6">
      <PageShell.Header title={title} actions={actions} actionContent={actionContent} />
      {description ? (
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

export { SettingsSection as ProfileTabSection } from "@ngriffin_uk/polychat-component-account";
