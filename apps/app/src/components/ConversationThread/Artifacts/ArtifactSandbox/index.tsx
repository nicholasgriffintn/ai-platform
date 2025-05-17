import type { ArtifactProps } from "~/types/artifact";
import { HtmlSandbox } from "./HtmlSandbox";
import { JavaScriptSandbox } from "./JavaScriptSandbox";
import { ReactSandbox } from "./ReactSandbox";
import { SvgSandbox } from "./SvgSandbox";

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

  const contentType = code.language || code.type?.split("/")[1];

  switch (contentType) {
    case "jsx":
    case "react":
    case "text/jsx":
    case "application/vnd.react":
      return (
        <ReactSandbox
          code={code}
          css={css}
          setPreviewError={setPreviewError}
          iframeKey={iframeKey}
        />
      );

    case "html":
    case "text/html":
    case "application/vnd.html":
      return (
        <HtmlSandbox
          code={code}
          css={css}
          setPreviewError={setPreviewError}
          iframeKey={iframeKey}
        />
      );

    case "svg":
    case "image/svg+xml":
    case "application/vnd.svg":
      return (
        <SvgSandbox
          code={code}
          setPreviewError={setPreviewError}
          iframeKey={iframeKey}
        />
      );

    case "javascript":
    case "js":
    case "text/javascript":
      return (
        <JavaScriptSandbox
          code={code}
          css={css}
          setPreviewError={setPreviewError}
          iframeKey={iframeKey}
        />
      );

    default:
      return (
        <ReactSandbox
          code={code}
          css={css}
          setPreviewError={setPreviewError}
          iframeKey={iframeKey}
        />
      );
  }
}
