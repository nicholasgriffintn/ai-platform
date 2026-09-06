import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface ProjectWorkbenchSectionProps {
  title: string;
  icon: LucideIcon;
  label?: string;
  className?: string;
  children: ReactNode;
}

export function ProjectWorkbenchSection({
  title,
  icon: Icon,
  label,
  className,
  children,
}: ProjectWorkbenchSectionProps) {
  return (
    <section aria-label={label ?? title} className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Icon className="text-creative size-4" aria-hidden="true" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </section>
  );
}
