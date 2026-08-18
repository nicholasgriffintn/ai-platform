import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  cn,
  SignInEmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import { formatDate, getBoundedPercentage } from "@ngriffin_uk/polychat-utility-core";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

const AUTH_DAILY_MESSAGE_LIMIT = 50;
const DAILY_LIMIT_PRO_MODELS = 200;

type UsageTone = "blue" | "purple" | "emerald";

const usageToneClasses: Record<UsageTone, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  emerald: "bg-emerald-500",
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
  daily_message_count?: number | null;
  daily_reset?: string | null;
  daily_pro_message_count?: number | null;
  daily_pro_reset?: string | null;
  daily_byok_message_count?: number | null;
  daily_byok_reset?: string | null;
}

export interface AccountOverviewProps {
  user?: AccountUser | null;
  isAuthenticated: boolean;
  isLoading?: boolean;
  onSignIn: () => void;
}

function formatResetCountdown(dateString: string | null | undefined) {
  if (!dateString) {
    return "N/A";
  }

  try {
    const lastResetDate = new Date(dateString);
    const nextResetDate = new Date(lastResetDate);

    nextResetDate.setHours(nextResetDate.getHours() + 24);

    const diffMs = nextResetDate.getTime() - Date.now();

    if (diffMs < 0) {
      return "any moment now";
    }

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
    }

    if (diffHours > 0) {
      return `in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
    }

    if (diffMins > 0) {
      return `in ${diffMins} minute${diffMins > 1 ? "s" : ""}`;
    }

    return `in ${diffSecs} second${diffSecs !== 1 ? "s" : ""}`;
  } catch {
    return "unknown time";
  }
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="gap-1 p-4 sm:p-5">
      <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 break-words">
        {value}
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>
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
  const percentage = limit ? getBoundedPercentage(used, limit) : null;

  return (
    <Card className="gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="font-medium text-zinc-900 dark:text-zinc-100">{title}</div>
        <div className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
          {limit ? `${used} / ${limit}` : `${used} today`}
        </div>
      </div>

      {percentage !== null && (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
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
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", usageToneClasses[tone])}
            aria-hidden="true"
          />
          <span>{description}</span>
        </div>
        <div className="text-zinc-500 dark:text-zinc-400">Resets {resets}</div>
      </div>

      {children}
    </Card>
  );
}

function ProfileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300"
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

  const isPro = user?.plan_id === "pro";

  const details: Array<{ label: string; value: string }> = [];

  if (user?.created_at) {
    details.push({ label: "Member since", value: formatDate(user.created_at) });
  }

  details.push({ label: "Plan", value: isPro ? "Pro" : "Free" });
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
              className="h-20 w-20 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-3xl font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-start">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {user?.name || "Your Account"}
              </h2>
              <Badge variant="secondary">{isPro ? "Pro plan" : "Free plan"}</Badge>
            </div>

            {user?.email && (
              <p className="break-all text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
            )}

            {user?.github_username && (
              <ProfileLink href={`https://github.com/${user.github_username}`}>
                @{user.github_username}
              </ProfileLink>
            )}

            {user?.bio && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {user.bio}
              </p>
            )}
          </div>
        </div>

        {details.length > 0 && (
          <dl className="grid grid-cols-1 gap-px border-t border-zinc-200 bg-zinc-200 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-card px-5 py-3 sm:px-6"
              >
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">{detail.label}</dt>
                <dd className="min-w-0 break-words text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {(site || user?.twitter_username) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-zinc-200 px-5 py-3 sm:px-6 dark:border-zinc-800">
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
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Usage</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Where the day's messages have gone.
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
          <UsageCard
            title="Standard usage"
            tone="blue"
            used={user?.daily_message_count || 0}
            limit={AUTH_DAILY_MESSAGE_LIMIT}
            description={`${AUTH_DAILY_MESSAGE_LIMIT} messages per day`}
            resets={formatResetCountdown(user?.daily_reset)}
          />

          {isPro && (
            <UsageCard
              title="Premium usage"
              tone="purple"
              used={user?.daily_pro_message_count || 0}
              limit={DAILY_LIMIT_PRO_MODELS}
              description={`${DAILY_LIMIT_PRO_MODELS} pro tokens per day`}
              resets={formatResetCountdown(user?.daily_pro_reset)}
            >
              <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <div className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Approximate message equivalents
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { label: "Expensive models", value: "~22 messages" },
                    { label: "Mid-tier models", value: "~66 messages" },
                    { label: "Cheaper models", value: "100-200 messages" },
                  ].map((tier) => (
                    <div
                      key={tier.label}
                      className="rounded-md bg-zinc-100 px-3 py-2 dark:bg-zinc-800"
                    >
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{tier.label}</div>
                      <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {tier.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </UsageCard>
          )}

          <UsageCard
            title="BYOK usage"
            tone="emerald"
            used={user?.daily_byok_message_count || 0}
            description="Unlimited provider-key messages"
            resets={formatResetCountdown(user?.daily_byok_reset)}
          />
        </div>

        <Alert variant="info">
          <AlertTitle>Function call usage</AlertTitle>
          <AlertDescription>
            When a message triggers a function call it counts as additional usage against your
            standard or premium limits, depending on the function that was called.
          </AlertDescription>
        </Alert>
      </section>
    </div>
  );
}
