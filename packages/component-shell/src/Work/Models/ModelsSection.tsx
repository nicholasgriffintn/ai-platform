import { SettingsSection } from "@ngriffin_uk/polychat-component-account";
import type { ReactNode } from "react";

export function ModelsSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SettingsSection
      plain
      title={title}
      description={description}
      actions={actions}
      className="space-y-3"
    >
      {children}
    </SettingsSection>
  );
}
