import { Check, Copy } from "lucide-react";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { cn } from "~/lib/utils";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";

interface CopyButtonProps {
	/** Value to copy to clipboard */
	value: string;
	/** Button variant */
	variant?: ButtonVariant;
	/** Button size */
	size?: ButtonSize;
	/** Optional label text */
	label?: string;
	/** Custom className */
	className?: string;
	/** Icon size */
	iconSize?: number;
	/** Callback after successful copy */
	onCopy?: () => void;
}

export function CopyButton({
	value,
	variant = "icon",
	size = "icon",
	label,
	className,
	iconSize = 14,
	onCopy,
}: CopyButtonProps) {
	const { copied, copy } = useCopyToClipboard();

	const handleCopy = () => {
		copy(value);
		onCopy?.();
	};

	return (
		<Button
			type="button"
			variant={variant}
			size={size}
			onClick={handleCopy}
			className={cn(
				variant === "icon" &&
					"cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center",
				copied
					? "text-green-500 dark:text-green-400 bg-green-100/50 dark:bg-green-900/20"
					: "text-zinc-500 dark:text-zinc-400",
				className,
			)}
			title={copied ? "Copied!" : label || "Copy to clipboard"}
			aria-label={copied ? "Copied!" : label || "Copy to clipboard"}
			icon={copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
		>
			{label && <span className="ml-2">{label}</span>}
		</Button>
	);
}
