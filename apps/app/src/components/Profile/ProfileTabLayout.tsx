import type { ComponentProps, ReactNode } from "react";

import { PageShell } from "~/components/Core/PageShell";

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
        <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

export { SettingsSection as ProfileTabSection } from "@ngriffin_uk/polychat-component-account";
