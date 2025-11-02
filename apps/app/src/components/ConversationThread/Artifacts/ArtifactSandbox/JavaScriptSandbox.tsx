import { useEffect, useState } from "react";

import type { ArtifactProps } from "~/types/artifact";
import { LoadingIndicator, SandboxIframe } from "./shared";

const JS_SANDBOX_TEMPLATE = `
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
    #output {
      padding: 16px;
      white-space: pre-wrap;
      font-family: monospace;
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
  <div id="output"></div>
  
  <script>
    (function() {
      // Capture console output
      const output = document.getElementById('output');
      
      const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };
      
      function appendToOutput(message, type = 'log') {
        const line = document.createElement('div');
        line.className = type;
        line.textContent = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
        output.appendChild(line);
      }
      
      console.log = function(...args) {
        originalConsole.log(...args);
        args.forEach(arg => appendToOutput(arg, 'log'));
      };
      
      console.error = function(...args) {
        originalConsole.error(...args);
        args.forEach(arg => appendToOutput(arg, 'error'));
      };
      
      console.warn = function(...args) {
        originalConsole.warn(...args);
        args.forEach(arg => appendToOutput(arg, 'warn'));
      };
      
      console.info = function(...args) {
        originalConsole.info(...args);
        args.forEach(arg => appendToOutput(arg, 'info'));
      };
      
      try {
        // Mock storage APIs
        class MockStorage {
          constructor() {
            this.store = {};
          }
          getItem(key) {
            return this.store[key] || null;
          }
          setItem(key, value) {
            this.store[key] = String(value);
          }
          removeItem(key) {
            delete this.store[key];
          }
          clear() {
            this.store = {};
          }
          key(n) {
            return Object.keys(this.store)[n] || null;
          }
          get length() {
            return Object.keys(this.store).length;
          }
        }
        
        // Safely assign mocks
        try {
          window.localStorage = window.localStorage || new MockStorage();
          window.sessionStorage = window.sessionStorage || new MockStorage();
        } catch (e) {
          Object.defineProperty(window, 'localStorage', { value: new MockStorage() });
          Object.defineProperty(window, 'sessionStorage', { value: new MockStorage() });
        }
        
        // Execute JS code
        <JS_CODE_PLACEHOLDER>
        
      } catch (error) {
        console.error('Error executing JavaScript:', error);
        const errorElement = document.createElement('div');
        errorElement.className = 'error-container';
        errorElement.textContent = 'Error executing JavaScript: ' + error.message;
        
        const body = document.body;
        if (body.firstChild) {
          body.insertBefore(errorElement, body.firstChild);
        } else {
          body.appendChild(errorElement);
        }
      }
    })();
  </script>
</body>
</html>
`;

export function JavaScriptSandbox({
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
			let doc = JS_SANDBOX_TEMPLATE;

			if (css) {
				doc = doc.replace("<CSS_CODE_PLACEHOLDER>", css.content);
			} else {
				doc = doc.replace("<CSS_CODE_PLACEHOLDER>", "");
			}

			doc = doc.replace("<JS_CODE_PLACEHOLDER>", code.content);

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
