export type AppTheme =
	| "violet"
	| "indigo"
	| "pink"
	| "rose"
	| "cyan"
	| "emerald"
	| "amber"
	| "sky"
	| "slate";

export type AppKind = "dynamic" | "frontend";

export interface AppSchema {
	id: string;
	name: string;
	description: string;
	icon?: string;
	category?: string;
	theme?: AppTheme;
	tags?: string[];
	featured?: boolean;
	costPerCall?: number;
	isDefault?: boolean;
	type?: "normal" | "premium";
	formSchema: {
		steps: Array<{
			id: string;
			title: string;
			description?: string;
			fields: Array<{
				id: string;
				type: string;
				label: string;
				description?: string;
				placeholder?: string;
				required: boolean;
				defaultValue?: any;
				validation?: {
					pattern?: string;
					min?: number;
					max?: number;
					minLength?: number;
					maxLength?: number;
					options?: Array<{ label: string; value: string }>;
				};
			}>;
		}>;
	};
	responseSchema: {
		type: string;
		display: {
			fields?: Array<{
				key: string;
				label: string;
				format?: string;
			}>;
			template?: string;
		};
	};
}

export interface AppListItem {
	id: string;
	name: string;
	description: string;
	icon?: string;
	category?: string;
	theme?: AppTheme;
	tags?: string[];
	featured?: boolean;
	href?: string;
	costPerCall?: number;
	isDefault?: boolean;
	type?: "normal" | "premium";
	kind?: AppKind;
}

export interface DynamicAppsResponse {
	apps: AppListItem[];
}
