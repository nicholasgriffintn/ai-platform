import type { ArtifactProps } from "~/types/artifact";
import { HtmlSandbox } from "./HtmlSandbox";
import { JavaScriptSandbox } from "./JavaScriptSandbox";
import { ReactSandbox } from "./ReactSandbox";
import { SvgSandbox } from "./SvgSandbox";

type ArtifactSandboxKind = "html" | "javascript" | "react" | "svg";

function getArtifactSandboxKind(code: ArtifactProps): ArtifactSandboxKind {
	const type = code.type.toLowerCase();
	const language = code.language?.toLowerCase();

	if (type === "image/svg+xml" || type === "application/vnd.svg" || language === "svg") {
		return "svg";
	}

	if (type === "text/html" || type === "application/vnd.html" || language === "html") {
		return "html";
	}

	if (type === "text/javascript" || language === "javascript" || language === "js") {
		return "javascript";
	}

	if (
		type === "text/jsx" ||
		type === "application/vnd.react" ||
		language === "jsx" ||
		language === "react"
	) {
		return "react";
	}

	return "react";
}

export function ArtifactSandbox({
	code,
	css,
	setPreviewError,
	iframeKey,
}: {
	code?: ArtifactProps;
	css?: ArtifactProps;
	setPreviewError: (error: string | null) => void;
	iframeKey: number;
}) {
	if (!code) {
		return (
			<div className="flex items-center justify-center h-full w-full bg-white dark:bg-zinc-800 p-4 text-sm text-zinc-500 dark:text-zinc-400">
				No code to display
			</div>
		);
	}

	switch (getArtifactSandboxKind(code)) {
		case "react":
			return (
				<ReactSandbox
					code={code}
					css={css}
					setPreviewError={setPreviewError}
					iframeKey={iframeKey}
				/>
			);

		case "html":
			return (
				<HtmlSandbox
					code={code}
					css={css}
					setPreviewError={setPreviewError}
					iframeKey={iframeKey}
				/>
			);

		case "svg":
			return <SvgSandbox code={code} setPreviewError={setPreviewError} iframeKey={iframeKey} />;

		case "javascript":
			return (
				<JavaScriptSandbox
					code={code}
					css={css}
					setPreviewError={setPreviewError}
					iframeKey={iframeKey}
				/>
			);
	}
}
