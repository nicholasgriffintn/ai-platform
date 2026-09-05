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
  { label: "Discovery notes", detail: "3 people", colour: "bg-active-work" },
  { label: "Launch plan", detail: "In progress", colour: "bg-attention" },
  { label: "Project brief", detail: "Updated today", colour: "bg-success" },
] as const;

export function WorkAccessEmptyState() {
  return (
    <section
      aria-labelledby="work-access-title"
      className="relative isolate w-full overflow-hidden rounded-[1.75rem] border border-border bg-surface px-6 py-8 shadow-2xl sm:px-10 sm:py-10 lg:px-12 lg:py-12"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-active-work/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-creative/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_34%)]" />
      </div>

      <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:gap-16">
        <div className="max-w-xl">
          <h2
            id="work-access-title"
            className="max-w-lg text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl"
          >
            Unlock shared workspaces.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
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

          <div className="mt-9 grid max-w-xl gap-3 border-t border-border pt-5 sm:grid-cols-3">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
              >
                <Icon size={15} className="shrink-0 text-active-work" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative mx-auto w-full max-w-[350px] lg:mx-0 lg:justify-self-end"
        >
          <div className="absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-full bg-active-work/20 blur-3xl" />
          <div className="relative rotate-2 rounded-[1.25rem] border border-border bg-surface-elevated/90 p-2 shadow-xl">
            <div className="rounded-[0.9rem] border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-active-work text-canvas shadow-sm">
                  <BriefcaseBusiness size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">Product launch</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Shared workspace</p>
                </div>
                <span className="rounded-full bg-active-work/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-active-work">
                  Pro
                </span>
              </div>

              <div className="mt-5 space-y-2">
                {workspacePreviewItems.map(({ colour, detail, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-lg border border-border/80 bg-surface-elevated px-3 py-2.5"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colour}`} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                      {label}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{detail}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <div className="flex -space-x-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-attention text-[10px] font-bold text-attention">
                    A
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-success text-[10px] font-bold text-success">
                    M
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-active-work text-[10px] font-bold text-background">
                    +
                  </span>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                  <Check size={13} className="text-success" />
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
