import { ButtonLink } from "@ngriffin_uk/polychat-component-ui";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Crown,
  FolderKanban,
  MessageSquareText,
  UsersRound,
} from "lucide-react";

const features = [
  { label: "Organise projects", icon: FolderKanban },
  { label: "Keep context together", icon: MessageSquareText },
  { label: "Invite collaborators", icon: UsersRound },
] as const;

const workspacePreviewItems = [
  { label: "Discovery notes", detail: "3 people", colour: "bg-blue-500" },
  { label: "Launch plan", detail: "In progress", colour: "bg-amber-400" },
  { label: "Project brief", detail: "Updated today", colour: "bg-emerald-400" },
] as const;

export function WorkAccessEmptyState() {
  return (
    <section
      aria-labelledby="work-access-title"
      className="relative isolate w-full overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white px-6 py-8 shadow-2xl shadow-zinc-950/5 sm:px-10 sm:py-10 lg:px-12 lg:py-12 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/20"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_34%)]" />
      </div>

      <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:gap-16">
        <div className="max-w-xl">
          <h2
            id="work-access-title"
            className="max-w-lg text-3xl font-semibold tracking-[-0.03em] text-zinc-950 sm:text-4xl dark:text-white"
          >
            Unlock shared workspaces.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
            Workspaces are included with Pro. Upgrade to organise projects, keep decisions in one
            place, and collaborate with your team.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink
              variant="primary"
              size="lg"
              href="/profile?tab=billing"
              icon={<Crown size={17} />}
            >
              Upgrade to Pro
            </ButtonLink>
            <ButtonLink variant="ghost" size="lg" href="/chat">
              Open Chat
              <ArrowUpRight size={15} />
            </ButtonLink>
          </div>

          <div className="mt-9 grid max-w-xl gap-3 border-t border-zinc-200 pt-5 sm:grid-cols-3 dark:border-zinc-800">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300"
              >
                <Icon size={15} className="shrink-0 text-blue-500" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative mx-auto w-full max-w-[350px] lg:mx-0 lg:justify-self-end"
        >
          <div className="absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative rotate-2 rounded-[1.25rem] border border-zinc-200 bg-zinc-100/90 p-2 shadow-xl shadow-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900/90 dark:shadow-black/40">
            <div className="rounded-[0.9rem] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                  <BriefcaseBusiness size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                    Product launch
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Shared workspace
                  </p>
                </div>
                <span className="rounded-full bg-blue-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                  Pro
                </span>
              </div>

              <div className="mt-5 space-y-2">
                {workspacePreviewItems.map(({ colour, detail, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colour}`} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
                      {label}
                    </span>
                    <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">
                      {detail}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div className="flex -space-x-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-[10px] font-bold text-amber-950 dark:border-zinc-950">
                    A
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-400 text-[10px] font-bold text-emerald-950 dark:border-zinc-950">
                    M
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-[10px] font-bold text-white dark:border-zinc-950">
                    +
                  </span>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                  <Check size={13} className="text-emerald-500" />
                  In sync
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
