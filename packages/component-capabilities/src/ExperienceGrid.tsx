import { Card, cn, Link } from "@ngriffin_uk/polychat-component-ui";
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
          <Card className="h-full gap-5 p-6 shadow-none transition-colors group-hover:border-zinc-400 dark:group-hover:border-zinc-600">
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  getIconContainerClass(experience.theme),
                )}
              >
                {getIcon(experience.icon, experience.theme)}
              </span>
              <ArrowRight size={17} className="text-zinc-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {experience.category}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-950 group-hover:underline dark:text-white">
                {experience.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{experience.description}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function ManageCapabilitiesLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Manage capabilities"
      title="Manage capabilities"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-md border border-zinc-300 text-sm text-zinc-900 no-underline transition-colors hover:bg-zinc-100 hover:no-underline focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:w-auto sm:px-3"
    >
      <Settings2 size={16} />
      <span className="hidden sm:inline">Manage capabilities</span>
    </Link>
  );
}
