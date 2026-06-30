import { AppWindow, AlertTriangle } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";

import { isStylesheetArtifact } from "~/lib/artifacts";
import type { ArtifactProps } from "~/types/artifact";
import { ArtifactSandbox } from "./ArtifactSandbox";

interface ArtifactInlinePreviewProps {
	artifact: ArtifactProps;
	artifacts?: ArtifactProps[];
}

const InlinePreviewLoading = () => (
	<div className="flex h-full w-full items-center justify-center bg-white p-4 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
		Loading preview...
	</div>
);

export function ArtifactInlinePreview({ artifact, artifacts = [] }: ArtifactInlinePreviewProps) {
	const [iframeKey, setIframeKey] = useState(0);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const cssArtifact = useMemo(
		() => artifacts.find((item) => isStylesheetArtifact(item)),
		[artifacts],
	);
	const title = artifact.title || artifact.identifier || "Inline artifact";

	useEffect(() => {
		setPreviewError(null);
		setIframeKey((currentKey) => currentKey + 1);
	}, [artifact.content, artifact.identifier]);

	return (
		<section
			aria-label={`Inline artifact preview: ${title}`}
			className="my-3 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
		>
			<div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
				<div className="flex min-w-0 items-center gap-2">
					<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950">
						<AppWindow size={14} aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
							{title}
						</div>
						<div className="text-xs text-zinc-500 dark:text-zinc-400">Inline HTML preview</div>
					</div>
				</div>
				<span className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
					Preview
				</span>
			</div>

			{previewError && (
				<div className="m-3 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
					<AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
					<pre className="min-w-0 whitespace-pre-wrap text-xs">{previewError}</pre>
				</div>
			)}

			<div
				data-inline-preview-viewport="true"
				className="h-[75vh] min-h-[420px] bg-white dark:bg-zinc-900"
			>
				<Suspense fallback={<InlinePreviewLoading />}>
					<ArtifactSandbox
						code={artifact}
						css={cssArtifact}
						setPreviewError={setPreviewError}
						iframeKey={iframeKey}
					/>
				</Suspense>
			</div>
		</section>
	);
}
