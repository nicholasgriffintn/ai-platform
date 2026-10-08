export const ARTIFACT_SCRIPT_SOURCES = {
  react: "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
  reactDom:
    "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
  propTypes: "https://cdnjs.cloudflare.com/ajax/libs/prop-types/15.8.1/prop-types.min.js",
  recharts: "https://cdnjs.cloudflare.com/ajax/libs/recharts/2.15.0/Recharts.min.js",
} as const;

const BASE_STYLES = `
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
}`;

const RUNTIME_PRELUDE = `
var root = document.getElementById("root");
function showError(message) {
  var element = document.createElement("div");
  element.className = "error-container";
  element.textContent = "Error rendering component: " + message;
  document.body.insertBefore(element, document.body.firstChild);
}
function MemoryStorage() { this.store = {}; }
MemoryStorage.prototype.getItem = function (key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; };
MemoryStorage.prototype.setItem = function (key, value) { this.store[key] = String(value); };
MemoryStorage.prototype.removeItem = function (key) { delete this.store[key]; };
MemoryStorage.prototype.clear = function () { this.store = {}; };
MemoryStorage.prototype.key = function (index) { return Object.keys(this.store)[index] || null; };
Object.defineProperty(MemoryStorage.prototype, "length", { get: function () { return Object.keys(this.store).length; } });
try {
  Object.defineProperty(window, "localStorage", { value: new MemoryStorage() });
  Object.defineProperty(window, "sessionStorage", { value: new MemoryStorage() });
} catch (error) {}
var pendingReads = new Map();
var nextRequestId = 1;
window.addEventListener("message", function (event) {
  if (event.source !== window.parent) return;
  var message = event.data;
  if (!message || message.type !== "polychat:binding-result") return;
  var settle = pendingReads.get(message.requestId);
  if (!settle) return;
  pendingReads.delete(message.requestId);
  settle(message);
});
function readBinding(id, args) {
  return new Promise(function (resolve) {
    var requestId = nextRequestId++;
    pendingReads.set(requestId, resolve);
    window.parent.postMessage({ type: "polychat:binding-read", requestId: requestId, bindingId: String(id), args: args || {} }, "*");
  });
}
function usePolychatData(id) {
  var state = React.useState({ data: undefined, error: null, loading: true });
  var value = state[0];
  var setValue = state[1];
  var load = React.useCallback(function (args) {
    setValue(function (current) { return { data: current.data, error: null, loading: true }; });
    return readBinding(id, args).then(function (result) {
      setValue(result.ok
        ? { data: result.data, error: null, loading: false }
        : { data: undefined, error: result.error || "The data could not be loaded.", loading: false });
    });
  }, [id]);
  React.useEffect(function () { load(); }, [load]);
  return { data: value.data, error: value.error, loading: value.loading, refetch: load };
}
var artifactModules = {
  react: window.React,
  "react-dom": window.ReactDOM,
  "react-dom/client": window.ReactDOM,
  recharts: window.Recharts,
  "@polychat/data": { usePolychatData: usePolychatData }
};
function require(name) {
  if (Object.prototype.hasOwnProperty.call(artifactModules, name) && artifactModules[name]) return artifactModules[name];
  throw new Error('Artifacts cannot import "' + name + '". Use react, recharts or @polychat/data.');
}
var module = { exports: {} };
`;

const RUNTIME_RENDER = `
var exported = module.exports;
var Component = exported && (exported.default || (typeof exported === "function" ? exported : null));
if (typeof Component !== "function") throw new Error("The artifact must export a React component as its default export.");
ReactDOM.createRoot(root).render(React.createElement(Component));
`;

function scriptTag(src: string): string {
  return `<script src="${src}" crossorigin="anonymous"></script>`;
}

function escapeInlineScript(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}

function escapeInlineStyle(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

export function buildReactArtifactDocument(params: {
  transpiledCode: string;
  css?: string;
  usesRecharts: boolean;
}): string {
  const scripts = [
    ARTIFACT_SCRIPT_SOURCES.react,
    ARTIFACT_SCRIPT_SOURCES.reactDom,
    ...(params.usesRecharts
      ? [ARTIFACT_SCRIPT_SOURCES.propTypes, ARTIFACT_SCRIPT_SOURCES.recharts]
      : []),
  ];

  return [
    "<!DOCTYPE html>",
    '<html><head><meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<style>${BASE_STYLES}</style>`,
    `<style id="css-content">${escapeInlineStyle(params.css ?? "")}</style>`,
    '</head><body><div id="root"></div>',
    ...scripts.map(scriptTag),
    "<script>(function () {",
    RUNTIME_PRELUDE,
    "try {",
    "(function (require, module, exports) {",
    escapeInlineScript(params.transpiledCode),
    "\n})(require, module, module.exports);",
    RUNTIME_RENDER,
    "} catch (error) { console.error(error); showError(error && error.message ? error.message : String(error)); }",
    "})();</script>",
    "</body></html>",
  ].join("\n");
}
