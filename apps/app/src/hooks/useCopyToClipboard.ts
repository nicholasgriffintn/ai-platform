import { useCallback, useState } from "react";

export const useCopyToClipboard = (timeout = 2000) => {
	const [copied, setCopied] = useState(false);

	const copy = useCallback(
		(content: string) => {
			navigator.clipboard
				.writeText(content)
				.then(() => {
					setCopied(true);
					const timer = setTimeout(() => setCopied(false), timeout);
					return () => clearTimeout(timer);
				})
				.catch((err) => console.error("Failed to copy content: ", err));
		},
		[timeout],
	);

	return { copied, copy };
};
