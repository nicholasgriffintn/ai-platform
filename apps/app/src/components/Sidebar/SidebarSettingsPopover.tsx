import {
	Check,
	ChevronDown,
	ChevronUp,
	ExternalLink,
	FileText,
	KeyRound,
	Keyboard,
	Loader2,
	LogIn,
	Monitor,
	Moon,
	Palette,
	Settings2,
	ShieldCheck,
	Sun,
	User,
	Wrench,
	WalletCards,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import GithubIcon from "~/components/ModelIcon/Icons/github";
import { Button, Popover, PopoverContent, PopoverTrigger } from "~/components/ui";
import { useAuthStatus } from "~/hooks/useAuth";
import { useTheme } from "~/hooks/useTheme";
import { getSidebarUsageItems, type SidebarUsageItem } from "~/lib/sidebar-usage";
import { cn } from "~/lib/utils";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { useUsageStore } from "~/state/stores/usageStore";
import type { Theme, User as AuthUser } from "~/types";

const usageToneClasses: Record<SidebarUsageItem["tone"], string> = {
	blue: "bg-blue-500",
	emerald: "bg-emerald-500",
	amber: "bg-amber-500",
};

const themeOptions: Array<{
	value: Theme;
	label: string;
	icon: ComponentType<{ className?: string }>;
}> = [
	{ value: "system", label: "System", icon: Monitor },
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
];

function SidebarUsageSummary() {
	const usageLimits = useUsageStore((state) => state.usageLimits);
	const usageItems = getSidebarUsageItems(usageLimits);

	return (
		<section className="p-3 border-b border-zinc-200 dark:border-zinc-700">
			<div className="mb-3 flex items-center justify-between gap-3">
				<div>
					<h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Usage</h2>
				</div>
			</div>

			{usageItems.length === 0 ? (
				<p className="text-sm text-zinc-500 dark:text-zinc-400">
					Usage appears after Polychat sees your first message.
				</p>
			) : (
				<div className="space-y-3">
					{usageItems.map((item) => (
						<div key={item.id}>
							<div className="mb-1 flex items-center justify-between gap-3 text-xs">
								<span className="font-medium text-zinc-700 dark:text-zinc-200">{item.label}</span>
								<span className="text-zinc-500 dark:text-zinc-400">{item.value}</span>
							</div>
							{item.percentage === null ? (
								<div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
									<span className={cn("h-1.5 w-1.5 rounded-full", usageToneClasses[item.tone])} />
									<span>Unlimited usage</span>
								</div>
							) : (
								<div
									className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800"
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
	isAuthenticated,
	isLoading,
	user,
}: {
	isAuthenticated: boolean;
	isLoading: boolean;
	user: AuthUser | null;
}) {
	if (isLoading) {
		return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
	}

	if (!isAuthenticated || !user) {
		return <Settings2 className="h-4 w-4" aria-hidden="true" />;
	}

	if (user.avatar_url) {
		return (
			<img
				src={user.avatar_url}
				alt=""
				className="h-5 w-5 rounded-full object-cover"
				loading="eager"
			/>
		);
	}

	return (
		<span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-semibold text-white">
			{user.name ? user.name.charAt(0).toUpperCase() : "U"}
		</span>
	);
}

function PopoverLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
	return (
		<Link
			to={to}
			className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 no-underline transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
		>
			{icon}
			<span>{children}</span>
		</Link>
	);
}

export function SidebarSettingsPopover() {
	const { setShowKeyboardShortcuts, setShowLoginModal } = useUIStore();
	const { user, isLoading } = useAuthStatus();
	const isAuthenticated = useChatStore((state) => state.isAuthenticated);
	const [theme, setTheme] = useTheme();
	const [isMounted, setIsMounted] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const displayName = isAuthenticated && user?.name ? user.name : "Settings";
	const planLabel = isAuthenticated ? (user?.plan_id === "pro" ? "Pro" : "Free") : "Guest";
	const currentTheme = themeOptions.find((option) => option.value === theme) ?? themeOptions[0];
	const CurrentThemeIcon = currentTheme.icon;
	const TriggerIcon = isOpen ? ChevronUp : ChevronDown;

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex w-full min-w-0 items-center justify-between gap-3 rounded-none bg-zinc-50 px-3 py-3 text-left text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/40 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
					aria-label="Open settings and configuration"
				>
					<span className="flex min-w-0 items-center gap-2">
						<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
							<SidebarUserAvatar
								isAuthenticated={isAuthenticated}
								isLoading={isLoading}
								user={user ?? null}
							/>
						</span>
						<span className="flex min-w-0 flex-1 items-center gap-2">
							<span className="min-w-0 truncate text-sm font-medium">{displayName}</span>
							<span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
								{planLabel}
							</span>
						</span>
					</span>
					<TriggerIcon
						className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400"
						aria-hidden="true"
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="center"
				side="top"
				sideOffset={8}
				collisionPadding={{ top: 64, right: 8, bottom: 88, left: 8 }}
				className="w-[calc(var(--radix-popover-trigger-width)-1rem)] max-w-[calc(var(--radix-popover-trigger-width)-1rem)] border-zinc-200 bg-off-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
			>
				<div className="space-y-3">
					<SidebarUsageSummary />

					<div className="space-y-1">
						{isAuthenticated ? (
							<>
								<PopoverLink to="/profile" icon={<User className="h-4 w-4" />}>
									Account
								</PopoverLink>
								<PopoverLink to="/profile?tab=customisation" icon={<Wrench className="h-4 w-4" />}>
									Customisation
								</PopoverLink>
								<PopoverLink to="/profile?tab=providers" icon={<KeyRound className="h-4 w-4" />}>
									Providers and keys
								</PopoverLink>
								<PopoverLink to="/profile?tab=billing" icon={<WalletCards className="h-4 w-4" />}>
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
								onClick={() => setShowLoginModal(true)}
							>
								Sign in
							</Button>
						)}
					</div>

					<div className="space-y-1">
						<button
							type="button"
							onClick={() => setIsThemeMenuOpen((open) => !open)}
							className="flex w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
							aria-expanded={isThemeMenuOpen}
							aria-label={`Theme. Current: ${currentTheme.label}`}
						>
							<Palette className="h-4 w-4" />
							<span>Theme</span>
							{isMounted && (
								<span className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
									<CurrentThemeIcon className="h-3.5 w-3.5" />
									{currentTheme.label}
								</span>
							)}
							{isThemeMenuOpen ? (
								<ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
							) : (
								<ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
							)}
						</button>
						{isThemeMenuOpen && (
							<div className="ml-6 space-y-1 border-l border-zinc-200 pl-2 dark:border-zinc-700">
								{themeOptions.map((option) => {
									const Icon = option.icon;
									const isSelected = isMounted && theme === option.value;

									return (
										<button
											key={option.value}
											type="button"
											onClick={() => setTheme(option.value)}
											className={cn(
												"flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
												isSelected
													? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
													: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
											)}
											aria-pressed={isSelected}
										>
											<Icon className="h-4 w-4" />
											<span>{option.label}</span>
											{isSelected && <Check className="ml-auto h-4 w-4" />}
										</button>
									);
								})}
							</div>
						)}
					</div>

					<div className="space-y-1 border-t border-zinc-200 pt-2 dark:border-zinc-700">
						<button
							type="button"
							onClick={() => setShowKeyboardShortcuts(true)}
							className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
						>
							<Keyboard className="h-4 w-4" />
							<span>Keyboard shortcuts</span>
						</button>
						<PopoverLink to="/terms" icon={<FileText className="h-4 w-4" />}>
							Terms
						</PopoverLink>
						<PopoverLink to="/privacy" icon={<ShieldCheck className="h-4 w-4" />}>
							Privacy
						</PopoverLink>
						<a
							href="https://github.com/nicholasgriffintn/personal-ai-assistant"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 no-underline transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
						>
							<span aria-hidden="true">
								<GithubIcon size={16} />
							</span>
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
