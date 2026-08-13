import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	type ButtonVariant,
} from "@ngriffin_uk/polychat-component-ui";
import { Check, Copy, Share2 } from "lucide-react";

export type ShareableContentType =
	| "conversation"
	| "app"
	| "note"
	| "article"
	| "podcast"
	| "drawing";

export interface ShareDialogLabels {
	share?: string;
	manage?: string;
	title?: string;
	manageTitle?: string;
	description?: string;
	sharedDescription?: string;
	shareButton?: string;
	unshareButton?: string;
}

export interface ShareDialogProps {
	type: ShareableContentType;
	isOpen: boolean;
	isPublic: boolean;
	shareUrl?: string;
	isSharing?: boolean;
	isUnsharing?: boolean;
	copied?: boolean;
	variant?: ButtonVariant;
	className?: string;
	labels?: ShareDialogLabels;
	onOpenChange: (open: boolean) => void;
	onShare: () => void;
	onUnshare: () => void;
	onCopy: (value: string) => void;
}

export function ShareDialog({
	type,
	isOpen,
	isPublic,
	shareUrl,
	isSharing = false,
	isUnsharing = false,
	copied = false,
	variant = "ghost",
	className,
	labels,
	onOpenChange,
	onShare,
	onUnshare,
	onCopy,
}: ShareDialogProps) {
	const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
	const finalLabels = {
		share: "Share",
		manage: "Manage",
		title: `Share ${typeLabel}`,
		manageTitle: `Manage Shared ${typeLabel}`,
		description: `Share this ${type} publicly. Anyone with the link will be able to view it.`,
		sharedDescription: `Your ${type} is publicly accessible with the following link:`,
		shareButton: `Share ${typeLabel}`,
		unshareButton: "Stop Sharing",
		...labels,
	};

	return (
		<>
			<Button
				variant={variant}
				size="sm"
				onClick={() => onOpenChange(true)}
				className={[
					variant === "ghost" &&
						"text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
					className,
				]
					.filter(Boolean)
					.join(" ")}
				title={isPublic ? `Manage shared ${type}` : `Share ${type}`}
				aria-label={isPublic ? `Manage shared ${type}` : `Share ${type}`}
				icon={<Share2 className="h-3.5 w-3.5" />}
			>
				<span className="whitespace-nowrap">
					{isPublic ? finalLabels.manage : finalLabels.share}
				</span>
			</Button>

			<Dialog open={isOpen} onOpenChange={onOpenChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{isPublic ? finalLabels.manageTitle : finalLabels.title}</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-2">
						{isPublic && shareUrl ? (
							<>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									{finalLabels.sharedDescription}
								</p>
								<div className="flex items-center gap-2">
									<div className="relative flex-1">
										<input
											type="text"
											readOnly
											value={shareUrl}
											aria-label="Share link"
											className="w-full rounded-md border border-zinc-200 bg-off-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
										/>
									</div>
									<Button
										variant="secondary"
										size="icon"
										onClick={() => onCopy(shareUrl)}
										title={copied ? "Copied!" : "Copy link"}
										aria-label="Copy link"
										className={copied ? "text-green-500 dark:text-green-400" : ""}
										icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
									/>
								</div>
								<Button
									variant="destructive"
									onClick={onUnshare}
									isLoading={isUnsharing}
									className="mt-4 w-full"
								>
									{isUnsharing ? "Removing Share..." : finalLabels.unshareButton}
								</Button>
							</>
						) : (
							<>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									{finalLabels.description}
								</p>
								<Button
									onClick={onShare}
									isLoading={isSharing}
									variant="primary"
									className="mt-4 w-full"
								>
									{isSharing ? "Creating Share..." : finalLabels.shareButton}
								</Button>
							</>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

export interface CopyButtonProps {
	value: string;
	copied?: boolean;
	label?: string;
	className?: string;
	onCopy: (value: string) => void;
}

export function CopyButton({ value, copied = false, label, className, onCopy }: CopyButtonProps) {
	return (
		<Button
			variant="secondary"
			size={label ? "sm" : "icon"}
			className={className}
			onClick={() => onCopy(value)}
			title={copied ? "Copied!" : (label ?? "Copy to clipboard")}
			aria-label={copied ? "Copied!" : (label ?? "Copy to clipboard")}
			icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
		>
			{label}
		</Button>
	);
}
