import { Badge, Card, cn, SignInEmptyState } from "@ngriffin_uk/polychat-component-ui";
import type { UsageBalanceResponse } from "@ngriffin_uk/polychat-schemas";
import { formatDate, getBoundedPercentage } from "@ngriffin_uk/polychat-utility-core";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { SettingsSection } from "../SettingsSection";

type UsageTone = "blue" | "purple";

const usageToneClasses: Record<UsageTone, string> = {
  blue: "bg-active-work",
  purple: "bg-creative",
};

export interface AccountUser {
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  site?: string | null;
  github_username?: string | null;
  twitter_username?: string | null;
  created_at?: string | null;
  last_active_at?: string | null;
  plan_id?: string | null;
  message_count?: number | null;
}

export interface AccountOverviewProps {
  user?: AccountUser | null;
  isAuthenticated: boolean;
  isLoading?: boolean;
  usageBalance?: UsageBalanceResponse | null;
  onSignIn: () => void;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="gap-1 p-5">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tracking-tight text-foreground break-words">
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </Card>
  );
}

function UsageCard({
  title,
  tone,
  used,
  limit,
  description,
  resets,
  children,
}: {
  title: string;
  tone: UsageTone;
  used: number;
  limit?: number;
  description: string;
  resets: string;
  children?: ReactNode;
}) {
  const percentage = limit !== undefined && limit > 0 ? getBoundedPercentage(used, limit) : null;

  return (
    <SettingsSection
      title={title}
      actions={
        <div className="text-sm tabular-nums text-muted-foreground">
          {limit !== undefined ? `${used} / ${limit}` : `${used} used`}
        </div>
      }
      contentClassName="space-y-3"
    >
      {percentage !== null && (
        <div
          className="bg-selection h-2 w-full overflow-hidden rounded-full"
          role="meter"
          aria-label={`${used} of ${limit} ${title.toLowerCase()} used today`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percentage)}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              usageToneClasses[tone],
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", usageToneClasses[tone])}
            aria-hidden="true"
          />
          <span>{description}</span>
        </div>
        <div className="text-muted-foreground">Resets {resets}</div>
      </div>

      {children}
    </SettingsSection>
  );
}

function ProfileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 text-sm text-foreground"
    >
      <span className="truncate">{children}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
    </a>
  );
}

export function AccountOverview({
  user,
  isAuthenticated,
  isLoading = false,
  usageBalance,
  onSignIn,
}: AccountOverviewProps) {
  if (!isAuthenticated && !isLoading) {
    return (
      <SignInEmptyState
        title="Sign in to view your account"
        message="Sign in to see your plan, profile details and daily usage."
        onSignIn={onSignIn}
      />
    );
  }

  const hasPaidPlan = user?.plan_id === "pro" || user?.plan_id === "enterprise";
  const creditAllowance = usageBalance
    ? usageBalance.credits.included + usageBalance.credits.grace
    : null;

  const details: Array<{ label: string; value: string }> = [];

  if (user?.created_at) {
    details.push({ label: "Member since", value: formatDate(user.created_at) });
  }

  details.push({
    label: "Plan",
    value: user?.plan_id === "enterprise" ? "Enterprise" : hasPaidPlan ? "Pro" : "Free",
  });
  if (user?.company) {
    details.push({ label: "Company", value: user.company });
  }

  if (user?.location) {
    details.push({ label: "Location", value: user.location });
  }

  const site = user?.site
    ? user.site.startsWith("http")
      ? user.site
      : `https://${user.site}`
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-4">
      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:items-start sm:gap-5 sm:p-6 sm:text-left">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user?.name || "Your Account"}
              className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="bg-selection text-muted-foreground flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-3xl font-semibold">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-start">
              <h3 className="text-foreground text-lg font-bold">{user?.name || "Your Account"}</h3>
              <Badge variant="secondary">
                {user?.plan_id === "enterprise"
                  ? "Enterprise plan"
                  : hasPaidPlan
                    ? "Pro plan"
                    : "Free plan"}
              </Badge>
            </div>

            {user?.email && <p className="break-all text-sm text-muted-foreground">{user.email}</p>}

            {user?.github_username && (
              <ProfileLink href={`https://github.com/${user.github_username}`}>
                @{user.github_username}
              </ProfileLink>
            )}

            {user?.bio && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {user.bio}
              </p>
            )}
          </div>
        </div>

        {details.length > 0 && (
          <dl className="border-border bg-border grid grid-cols-1 gap-px border-t sm:grid-cols-2">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-card px-5 py-3 sm:px-6"
              >
                <dt className="text-sm text-muted-foreground">{detail.label}</dt>
                <dd className="min-w-0 break-words text-sm font-medium text-foreground">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {(site || user?.twitter_username) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-3 sm:px-6">
            {site && <ProfileLink href={site}>{user?.site}</ProfileLink>}
            {user?.twitter_username && (
              <ProfileLink href={`https://twitter.com/${user.twitter_username}`}>
                @{user.twitter_username}
              </ProfileLink>
            )}
          </div>
        )}
      </Card>

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-foreground text-lg font-bold">Usage</h3>
          <p className="text-sm text-muted-foreground">
            Model, capability and infrastructure work in one account.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Total messages"
            value={`${user?.message_count || 0}`}
            hint="Messages sent since joining"
          />
          <StatCard
            label="Last activity"
            value={user?.last_active_at ? formatDate(user.last_active_at) : "Never"}
            hint="Last time you used the platform"
          />
        </div>

        <div className="grid gap-4">
          {usageBalance && creditAllowance !== null && (
            <UsageCard
              title="Credits"
              tone="purple"
              used={usageBalance.credits.used}
              limit={creditAllowance > 0 ? creditAllowance : undefined}
              description="Usage across models and metered capabilities this month"
              resets={formatDate(usageBalance.resets_at)}
            />
          )}
        </div>
      </section>
    </div>
  );
}
