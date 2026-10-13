import { useMemo } from "react";

import { hardenStandaloneHtml } from "./shared";

export function HardenedHtmlFrame({
  html,
  title,
  className,
}: {
  html: string;
  title: string;
  className?: string;
}) {
  const documentContent = useMemo(() => hardenStandaloneHtml(html), [html]);

  return (
    <iframe
      srcDoc={documentContent}
      className={className ?? "h-full w-full border-0"}
      sandbox="allow-scripts"
      title={title}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
