import { useEffect, useState } from "react";

import type { ArtifactProps } from "~/types/artifact";
import { LoadingIndicator, SandboxIframe } from "./shared";

const HTML_SANDBOX_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 0;
    }
    .error-container {
      padding: 16px;
      background-color: #fff0f0;
      color: #e00;
      border-left: 4px solid #e00;
      margin: 16px;
      border-radius: 4px;
      font-family: monospace;
      white-space: pre-wrap;
    }
  </style>
  <style id="css-content">
    <CSS_CODE_PLACEHOLDER>
  </style>
</head>
<body>
  <CONTENT_PLACEHOLDER>
</body>
</html>
`;

export function HtmlSandbox({
	code,
	css,
	setPreviewError,
	iframeKey,
}: {
	code: ArtifactProps;
	css?: ArtifactProps;
	setPreviewError: (error: string | null) => void;
	iframeKey: number;
}) {
	const [documentContent, setDocumentContent] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let isMounted = true;
		setIsLoading(true);

		const prepareDocument = async () => {
			let doc = HTML_SANDBOX_TEMPLATE;

			if (css) {
				doc = doc.replace("<CSS_CODE_PLACEHOLDER>", css.content);
			} else {
				doc = doc.replace("<CSS_CODE_PLACEHOLDER>", "");
			}

			doc = doc.replace("<CONTENT_PLACEHOLDER>", code.content);

			if (isMounted) {
				setDocumentContent(doc);
				setIsLoading(false);
			}
		};

		prepareDocument();

		return () => {
			isMounted = false;
		};
	}, [code, css]);

	if (isLoading) {
		return <LoadingIndicator />;
	}

	return (
		<SandboxIframe
			documentContent={documentContent}
			iframeKey={iframeKey}
			setPreviewError={setPreviewError}
		/>
	);
}
