import type * as BabelType from "@babel/standalone";
import { useEffect, useState } from "react";

import type { ArtifactProps } from "~/types/artifact";
import { LoadingIndicator, SandboxIframe } from "./shared";

export const removeDefaultExport = (
	input: string,
): {
	modifiedInput: string;
	exportedName: string | null;
} => {
	const defaultExportWithDeclarationRegex =
		/export\s+default\s+function\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*{[^}]*}/;

	const defaultExportRegex = /export\s+default\s+([A-Za-z0-9_]+);?/;

	let match = input.match(defaultExportWithDeclarationRegex);
	let exportedName: string | null = null;
	let modifiedInput = input;

	if (match) {
		exportedName = match[1];
		modifiedInput = modifiedInput
			.replace(/export\s+default\s+function/, "function")
			.trim();
	} else {
		match = input.match(defaultExportRegex);
		if (match) {
			exportedName = match[1];
			modifiedInput = modifiedInput.replace(defaultExportRegex, "").trim();
		}
	}

	return { modifiedInput, exportedName };
};

const memoizedTransformations = new Map<
	string,
	{ transpiledCode: string; componentName: string | null }
>();

let babelInstance: typeof BabelType | null = null;

const loadBabel = async (): Promise<typeof BabelType> => {
	if (babelInstance) return babelInstance;

	const module = await import("@babel/standalone");
	babelInstance = module;
	return module;
};

const transformComponentCode = async (code: string) => {
	const cachedResult = memoizedTransformations.get(code);
	if (cachedResult) {
		return cachedResult;
	}

	const { modifiedInput: codeWithoutExports, exportedName: componentName } =
		removeDefaultExport(code);

	const safeComponentName = componentName || "ReactComponent";

	const wrapperCode = `
// Handle imports with UMD
${codeWithoutExports}

// Directly expose the component to the global scope
if (typeof ${safeComponentName} !== 'undefined') {
  window.${safeComponentName} = ${safeComponentName};
}
`;

	const babel = await loadBabel();
	const transpiledCode = babel.transform(wrapperCode, {
		presets: ["react"],
		plugins: [
			[
				"transform-modules-umd",
				{
					globals: {
						react: "React",
						"react-dom": "ReactDOM",
					},
				},
			],
		],
	}).code;

	const result = {
		transpiledCode: transpiledCode || "",
		componentName: safeComponentName,
	};
	memoizedTransformations.set(code, result);
	return result;
};

const REACT_SANDBOX_TEMPLATE = `
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
    #root {
      padding: 16px;
      min-height: 100vh;
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
  <div id="root"></div>
  
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  
  <script>
    (function() {
      try {
        // Global definitions
        window.React = React;
        window.ReactDOM = ReactDOM;
        
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
        
        // Mock caches
        class MockCache {
          constructor() {
            this.storage = new Map();
          }
          
          async match() { return null; }
          async matchAll() { return []; }
          async add() { return Promise.resolve(); }
          async addAll() { return Promise.resolve(); }
          async put() { return Promise.resolve(); }
          async delete() { return Promise.resolve(false); }
          async keys() { return []; }
        }
        
        class MockCacheStorage {
          constructor() {
            this.caches = new Map();
          }
          
          async open(cacheName) {
            if (!this.caches.has(cacheName)) {
              this.caches.set(cacheName, new MockCache());
            }
            return this.caches.get(cacheName);
          }
          
          async has() { return Promise.resolve(false); }
          async delete() { return Promise.resolve(false); }
          async keys() { return []; }
          async match() { return null; }
        }
        
        // Safely assign mocks
        try {
          window.localStorage = window.localStorage || new MockStorage();
          window.sessionStorage = window.sessionStorage || new MockStorage();
          window.caches = window.caches || new MockCacheStorage();
        } catch (e) {
          Object.defineProperty(window, 'localStorage', { value: new MockStorage() });
          Object.defineProperty(window, 'sessionStorage', { value: new MockStorage() });
          Object.defineProperty(window, 'caches', { value: new MockCacheStorage() });
        }
        
        // Load and execute the component code
        <COMPONENT_CODE_PLACEHOLDER>
        
        // Get the component name
        const componentName = "<COMPONENT_NAME_PLACEHOLDER>";
        
        // Access the component from the global scope and render it
        if (typeof window[componentName] === 'function') {
          console.info("Component found:", componentName);
          const root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(window[componentName]));
        } else {
          console.error("Component not found:", componentName);
          console.info("Available global functions:", Object.keys(window).filter(k => typeof window[k] === 'function').join(", "));
          throw new Error('Component "' + componentName + '" not found or not a function');
        }
      } catch (error) {
        console.error('Error rendering component:', error);
        const errorElement = document.createElement('div');
        errorElement.className = 'error-container';
        errorElement.textContent = 'Error rendering component: ' + error.message;
        
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

export function ReactSandbox({
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
			let doc = REACT_SANDBOX_TEMPLATE;

			if (css) {
				doc = doc.replace("<CSS_CODE_PLACEHOLDER>", css.content);
			} else {
				doc = doc.replace("<CSS_CODE_PLACEHOLDER>", "");
			}

			try {
				const { transpiledCode, componentName } = await transformComponentCode(
					code.content,
				);

				doc = doc.replace("<COMPONENT_CODE_PLACEHOLDER>", transpiledCode || "");
				doc = doc.replace(
					"<COMPONENT_NAME_PLACEHOLDER>",
					componentName || "null",
				);
			} catch (err) {
				console.error("Error transforming:", err);
				doc = doc.replace(
					"<COMPONENT_CODE_PLACEHOLDER>",
					"console.error('Error transforming JSX.');",
				);
				doc = doc.replace("<COMPONENT_NAME_PLACEHOLDER>", "null");
			}

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
