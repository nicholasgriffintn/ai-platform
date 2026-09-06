import {
  Button,
  cn,
  Link,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ThemeMenu,
  type ThemePreference,
} from "@ngriffin_uk/polychat-component-ui";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  KeyRound,
  Keyboard,
  Loader2,
  LogIn,
  Settings2,
  ShieldCheck,
  User,
  WalletCards,
  Wrench,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

export interface SidebarUsageMeter {
  id: string;
  label: string;
  value: string;
  assistiveLabel: string;
  percentage: number | null;
  tone: "blue" | "emerald" | "amber" | "violet";
  reserveStartPercentage?: number;
  caption?: string;
}

export interface SidebarAccountSummary {
  name?: string | null;
  avatarUrl?: string | null;
  planLabel: string;
}

export interface SidebarSettingsLinks {
  account: string;
  customisation: string;
  providers: string;
  billing: string;
  terms: string;
  privacy: string;
  sourceCode: string;
}

export interface SidebarThemeControl {
  value: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}

const usageToneClasses: Record<SidebarUsageMeter["tone"], string> = {
  blue: "bg-active-work",
  emerald: "bg-success",
  amber: "bg-attention",
  violet: "bg-creative",
};

const popoverRowClassName =
  "text-popover-foreground hover:bg-selection hover:text-foreground flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm no-underline transition-colors";

function SidebarUsageSummary({
  usage,
  isLoading,
}: {
  usage: SidebarUsageMeter[];
  isLoading: boolean;
}) {
  return (
    <section className="border-border border-b p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground text-sm font-semibold">Usage</h2>
        </div>
      </div>

      {usage.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {isLoading ? "Loading usage…" : "Usage is temporarily unavailable."}
        </p>
      ) : (
        <div className="space-y-3">
          {usage.map((item) => (
            <div key={item.id}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="text-foreground font-medium">{item.label}</span>
                <span className="text-muted-foreground">{item.value}</span>
              </div>
              {item.percentage === null ? (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span className={cn("h-1.5 w-1.5 rounded-full", usageToneClasses[item.tone])} />
                  <span>{item.assistiveLabel}</span>
                </div>
              ) : (
                <div
                  className="bg-selection h-2 rounded-full"
                  role="meter"
                  aria-label={item.assistiveLabel}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(item.percentage)}
                >
                  <div
                    className={cn("h-full rounded-full", usageToneClasses[item.tone])}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SidebarUserAvatar({
  account,
  isAuthenticated,
  isLoading,
}: {
  account: SidebarAccountSummary | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
  }

  if (!isAuthenticated || !account) {
    return <Settings2 className="h-4 w-4" aria-hidden="true" />;
  }

  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt=""
        className="h-5 w-5 rounded-full object-cover"
        loading="eager"
      />
    );
  }

  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-creative text-[10px] font-semibold text-background">
      {account.name ? account.name.charAt(0).toUpperCase() : "U"}
    </span>
  );
}

function PopoverLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={popoverRowClassName}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

export interface SidebarSettingsPopoverProps {
  account: SidebarAccountSummary | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isUsageLoading?: boolean;
  links: SidebarSettingsLinks;
  sourceCodeIcon: ReactNode;
  usage: SidebarUsageMeter[];
  theme?: SidebarThemeControl;
  onShowKeyboardShortcuts: () => void;
  onSignIn: () => void;
}

export function SidebarSettingsPopover({
  account,
  isAuthenticated,
  isLoading,
  isUsageLoading = false,
  links,
  sourceCodeIcon,
  usage,
  theme,
  onShowKeyboardShortcuts,
  onSignIn,
}: SidebarSettingsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const displayName = isAuthenticated && account?.name ? account.name : "Settings";
  const planLabel = isAuthenticated ? (account?.planLabel ?? "Free") : "Guest";
  const TriggerIcon = isOpen ? ChevronUp : ChevronDown;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:ring-sidebar-ring flex w-full min-w-0 items-center justify-between gap-3 rounded-none px-3 py-3 text-left transition-colors focus:ring-2 focus:ring-inset focus:outline-none"
          aria-label="Open settings and configuration"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="bg-selection text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
              <SidebarUserAvatar
                account={account}
                isAuthenticated={isAuthenticated}
                isLoading={isLoading}
              />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="min-w-0 truncate text-sm font-medium">{displayName}</span>
              <span className="bg-selection text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium">
                {planLabel}
              </span>
            </span>
          </span>
          <TriggerIcon className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        tabIndex={-1}
        align="center"
        side="top"
        sideOffset={8}
        collisionPadding={{ top: 64, right: 8, bottom: 88, left: 8 }}
        className="border-border bg-popover text-popover-foreground w-[calc(var(--radix-popover-trigger-width)-1rem)] max-w-[calc(var(--radix-popover-trigger-width)-1rem)] p-3 shadow-[var(--polychat-elevated-shadow)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <div className="space-y-3">
          <SidebarUsageSummary usage={usage} isLoading={isUsageLoading} />

          <div className="space-y-1">
            {isAuthenticated ? (
              <>
                <PopoverLink href={links.account} icon={<User className="h-4 w-4" />}>
                  Account
                </PopoverLink>
                <PopoverLink href={links.customisation} icon={<Wrench className="h-4 w-4" />}>
                  Customisation
                </PopoverLink>
                <PopoverLink href={links.providers} icon={<KeyRound className="h-4 w-4" />}>
                  Providers and keys
                </PopoverLink>
                <PopoverLink href={links.billing} icon={<WalletCards className="h-4 w-4" />}>
                  Billing
                </PopoverLink>
              </>
            ) : (
              <Button
                type="button"
                variant="primary"
                fullWidth
                className="justify-start px-2.5 py-2 text-sm"
                icon={
                  isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )
                }
                onClick={onSignIn}
              >
                Sign in
              </Button>
            )}
          </div>

          <div className="border-border space-y-1 border-t pt-2">
            {theme && (
              <ThemeMenu
                value={theme.value}
                onChange={theme.onChange}
                triggerClassName={cn(
                  popoverRowClassName,
                  "data-[state=open]:bg-selection data-[state=open]:text-foreground",
                )}
              />
            )}
            <button type="button" onClick={onShowKeyboardShortcuts} className={popoverRowClassName}>
              <Keyboard className="h-4 w-4" />
              <span>Keyboard shortcuts</span>
            </button>
            <PopoverLink href={links.terms} icon={<FileText className="h-4 w-4" />}>
              Terms
            </PopoverLink>
            <PopoverLink href={links.privacy} icon={<ShieldCheck className="h-4 w-4" />}>
              Privacy
            </PopoverLink>
            <a
              href={links.sourceCode}
              target="_blank"
              rel="noopener noreferrer"
              className={popoverRowClassName}
            >
              <span aria-hidden="true">{sourceCodeIcon}</span>
              <span className="flex flex-1 items-center justify-between">
                GitHub <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
