import type { UsageLimits } from "~/state/stores/usageStore";
import { getBoundedPercentage } from "./percentage";

export interface SidebarUsageItem {
	id: string;
	label: string;
	value: string;
	assistiveLabel: string;
	percentage: number | null;
	tone: "blue" | "emerald" | "amber";
}

export function getBoundedUsagePercentage(used: number, limit: number) {
	return getBoundedPercentage(used, limit);
}

export function getSidebarUsageItems(usageLimits: UsageLimits | null): SidebarUsageItem[] {
	if (!usageLimits) {
		return [];
	}

	const items: SidebarUsageItem[] = [
		{
			id: "standard",
			label: "Standard lane",
			value: `${usageLimits.daily.used} / ${usageLimits.daily.limit}`,
			assistiveLabel: `${usageLimits.daily.used} of ${usageLimits.daily.limit} standard messages used today`,
			percentage: getBoundedUsagePercentage(usageLimits.daily.used, usageLimits.daily.limit),
			tone: "blue",
		},
	];

	if (usageLimits.pro) {
		items.push({
			id: "pro",
			label: "Pro runway",
			value: `${usageLimits.pro.used} / ${usageLimits.pro.limit}`,
			assistiveLabel: `${usageLimits.pro.used} of ${usageLimits.pro.limit} pro usage units used today`,
			percentage: getBoundedUsagePercentage(usageLimits.pro.used, usageLimits.pro.limit),
			tone: "amber",
		});
	}

	if (usageLimits.byok) {
		items.push({
			id: "byok",
			label: "Your keys",
			value: `${usageLimits.byok.used} today`,
			assistiveLabel: `${usageLimits.byok.used} bring your own key messages used today`,
			percentage: null,
			tone: "emerald",
		});
	}

	return items;
}
