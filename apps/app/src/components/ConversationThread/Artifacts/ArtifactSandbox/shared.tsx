export function LoadingIndicator() {
	return (
		<div className="flex items-center justify-center h-full w-full bg-white dark:bg-zinc-800 p-4 text-sm text-zinc-500 dark:text-zinc-400">
			Processing code...
		</div>
	);
}

export function SandboxIframe({
	documentContent,
	iframeKey,
	setPreviewError,
}: {
	documentContent: string | null;
	iframeKey: number;
	setPreviewError: (error: string | null) => void;
}) {
	const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
		try {
			const iframeDoc = e.currentTarget.contentDocument;
			const errorEl = iframeDoc?.querySelector(".error-container");

			if (errorEl) {
				setPreviewError(errorEl.textContent || "Unknown error");
			} else {
				setPreviewError(null);
			}
		} catch (err) {
			console.error("Error checking iframe:", err);
		}
	};

	return (
		<iframe
			key={iframeKey}
			srcDoc={documentContent || undefined}
			className="w-full h-full border-0"
			sandbox="allow-scripts"
			title="Code Preview"
			onLoad={handleIframeLoad}
			loading="lazy"
		/>
	);
}
