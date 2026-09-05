import { ButtonLink, Card, cn, Link } from "@ngriffin_uk/polychat-component-ui";
import { ArrowRight, Settings2 } from "lucide-react";

import { getIcon, getIconContainerClass } from "./capability-theme";

export interface ExperienceGridItem {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  icon?: string;
  theme?: string;
  href: string;
}

export function ExperienceGrid({ experiences }: { experiences: ExperienceGridItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {experiences.map((experience) => (
        <Link
          key={experience.id}
          href={experience.href}
          className="group no-underline hover:!no-underline"
        >
          <Card className="h-full gap-5 p-6 shadow-none transition-colors group-hover:border-border-strong">
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  getIconContainerClass(experience.theme),
                )}
              >
                {getIcon(experience.icon, experience.theme)}
              </span>
              <ArrowRight size={17} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {experience.category}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground group-hover:underline">
                {experience.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {experience.description}
              </p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function ManageCapabilitiesLink({ href }: { href: string }) {
  return (
    <ButtonLink
      variant="outline"
      size="sm"
      collapseLabel
      href={href}
      aria-label="Manage capabilities"
      title="Manage capabilities"
      className="shrink-0"
      icon={<Settings2 size={16} />}
    >
      Manage capabilities
    </ButtonLink>
  );
}
