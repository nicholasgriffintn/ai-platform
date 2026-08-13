import { CopyButton as ControlledCopyButton } from "@ngriffin_uk/polychat-component-content";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";

interface CopyButtonProps {
	value: string;
	label?: string;
	className?: string;
	variant?: string;
	size?: string;
	iconSize?: number;
	onCopy?: () => void;
}

export function CopyButton({ value, label, className, onCopy }: CopyButtonProps) {
	const { copied, copy } = useCopyToClipboard();
	return (
		<ControlledCopyButton
			value={value}
			label={label}
			className={className}
			copied={copied}
			onCopy={(content) => {
				copy(content);
				onCopy?.();
			}}
		/>
	);
}
