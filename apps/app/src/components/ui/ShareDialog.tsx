import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { cn } from "~/lib/utils";
import { Button } from "./Button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "./Dialog";

interface ShareDialogProps {
	/** Type of item being shared */
	type: "conversation" | "app" | "note" | "article" | "podcast" | "drawing";
	/** ID of the item to share */
	itemId: string;
	/** Whether the item is currently public */
	isPublic?: boolean;
	/** Current share ID if already shared */
	shareId?: string;
	/** Function to create a share link */
	onShare: (itemId: string) => Promise<{ share_id: string }>;
	/** Function to remove share link */
	onUnshare: (itemId: string) => Promise<void>;
	/** Function to generate the share URL from share_id */
	getShareUrl: (shareId: string) => string;
	/** Button variant */
	variant?: "default" | "outline" | "secondary" | "ghost" | "link";
	/** Custom className for the button */
	className?: string;
	/** Custom labels */
	labels?: {
		share?: string;
		manage?: string;
		title?: string;
		manageTitle?: string;
		description?: string;
		sharedDescription?: string;
		shareButton?: string;
		unshareButton?: string;
	};
}

export function ShareDialog({
	type,
	itemId,
	isPublic,
	shareId,
	onShare,
	onUnshare,
	getShareUrl,
	variant = "ghost",
	className,
	labels,
}: ShareDialogProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isSharing, setIsSharing] = useState(false);
	const [isUnsharing, setIsUnsharing] = useState(false);
	const [currentShareId, setCurrentShareId] = useState<string | undefined>(
		shareId,
	);
	const [currentIsPublic, setCurrentIsPublic] = useState<boolean | undefined>(
		isPublic,
	);
	const { copied, copy } = useCopyToClipboard();

	useEffect(() => {
		if (shareId) {
			setCurrentShareId(shareId);
		} else {
			setCurrentShareId(undefined);
		}

		if (isPublic) {
			setCurrentIsPublic(true);
		} else {
			setCurrentIsPublic(false);
		}
	}, [shareId, isPublic]);

	const handleShareClick = async () => {
		if (!itemId) return;

		try {
			setIsSharing(true);
			const result = await onShare(itemId);
			setCurrentShareId(result.share_id);
			setCurrentIsPublic(true);
			toast.success(
				labels?.shareButton || `${capitalize(type)} shared successfully`,
			);
		} catch (error) {
			console.error(`Error sharing ${type}:`, error);
			toast.error(labels?.shareButton || `Failed to share ${type}`);
		} finally {
			setIsSharing(false);
		}
	};

	const handleUnshareClick = async () => {
		if (!itemId) return;

		try {
			setIsUnsharing(true);
			await onUnshare(itemId);
			setCurrentIsPublic(false);
			setCurrentShareId(undefined);
			toast.success(labels?.unshareButton || `${capitalize(type)} unshared`);
		} catch (error) {
			console.error(`Error unsharing ${type}:`, error);
			toast.error(labels?.unshareButton || `Failed to unshare ${type}`);
		} finally {
			setIsUnsharing(false);
		}
	};

	const copyShareLink = () => {
		if (!currentShareId) return;

		const shareUrl = getShareUrl(currentShareId);
		copy(shareUrl);
	};

	const defaultLabels = {
		share: "Share",
		manage: "Manage",
		title: `Share ${capitalize(type)}`,
		manageTitle: `Manage Shared ${capitalize(type)}`,
		description: `Share this ${type} publicly. Anyone with the link will be able to view it.`,
		sharedDescription: `Your ${type} is publicly accessible with the following link:`,
		shareButton: `Share ${capitalize(type)}`,
		unshareButton: "Stop Sharing",
	};

	const finalLabels = { ...defaultLabels, ...labels };

	return (
		<>
			<Button
				variant={variant}
				size="sm"
				onClick={() => setIsOpen(true)}
				className={cn(
					variant === "ghost" &&
						"text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
					className,
				)}
				title={currentIsPublic ? `Manage shared ${type}` : `Share ${type}`}
				icon={<Share2 className="h-3.5 w-3.5" />}
			>
				<span className="whitespace-nowrap">
					{currentIsPublic ? finalLabels.manage : finalLabels.share}
				</span>
			</Button>

			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{currentIsPublic ? finalLabels.manageTitle : finalLabels.title}
						</DialogTitle>
					</DialogHeader>
					<DialogClose onClick={() => setIsOpen(false)} />

					<div className="space-y-4 py-2">
						{currentIsPublic && currentShareId ? (
							<>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									{finalLabels.sharedDescription}
								</p>
								<div className="flex items-center gap-2">
									<div className="relative flex-1">
										<input
											type="text"
											readOnly
											value={getShareUrl(currentShareId)}
											className={cn(
												"w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700",
												"bg-off-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
											)}
										/>
									</div>
									<Button
										variant="secondary"
										size="icon"
										onClick={copyShareLink}
										title={copied ? "Copied!" : "Copy link"}
										aria-label="Copy link"
										className={
											copied ? "text-green-500 dark:text-green-400" : ""
										}
										icon={
											copied ? (
												<Check className="h-4 w-4" />
											) : (
												<Copy className="h-4 w-4" />
											)
										}
									/>
								</div>
								<Button
									variant="destructive"
									onClick={handleUnshareClick}
									isLoading={isUnsharing}
									className="mt-4 w-full"
								>
									{isUnsharing
										? "Removing Share..."
										: finalLabels.unshareButton}
								</Button>
							</>
						) : (
							<>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									{finalLabels.description}
								</p>
								<Button
									onClick={handleShareClick}
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

function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
