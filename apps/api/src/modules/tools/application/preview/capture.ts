import {
  buildSandboxDocument,
  hardenSandboxDocument,
  HTML_SANDBOX_TEMPLATE,
  safeParseJson,
} from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

const MAX_ENTRIES = 20;
const MAX_MESSAGE_CHARS = 600;

const previewMessage = z.string().transform((value) => value.slice(0, MAX_MESSAGE_CHARS));
const previewReportSchema = z.object({
  console: z
    .array(z.object({ level: z.enum(["error", "warn"]), message: previewMessage }))
    .transform((entries) => entries.slice(0, MAX_ENTRIES)),
  errors: z
    .array(z.object({ message: previewMessage, source: previewMessage.optional() }))
    .transform((entries) => entries.slice(0, MAX_ENTRIES)),
  requests: z
    .array(z.object({ url: previewMessage, reason: previewMessage }))
    .transform((entries) => entries.slice(0, MAX_ENTRIES)),
  contentHeight: z.number().nonnegative(),
  contentWidth: z.number().nonnegative(),
  viewportWidth: z.number().nonnegative(),
});

export type PreviewReport = z.infer<typeof previewReportSchema>;

function buildCaptureScript(reportId: string): string {
  return String.raw`<script>(function () {
  var reportId = ${JSON.stringify(reportId)};
  var limit = ${MAX_ENTRIES};
  var report = { console: [], errors: [], requests: [], contentHeight: 0, contentWidth: 0, viewportWidth: 0 };
  function describe(value) {
    try {
      if (value instanceof Error) { return value.stack || value.message || String(value); }
      if (typeof value === "object" && value !== null) { return JSON.stringify(value); }
      return String(value);
    } catch (error) { return String(value); }
  }
  function clip(value) { return String(value).slice(0, ${MAX_MESSAGE_CHARS}); }
  function write() {
    var root = document.documentElement;
    if (!root) { return; }
    var node = document.getElementById(reportId);
    if (!node) {
      node = document.createElement("script");
      node.type = "application/json";
      node.id = reportId;
      root.appendChild(node);
    }
    var body = document.body;
    report.contentHeight = body ? body.scrollHeight : root.scrollHeight;
    report.contentWidth = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
    report.viewportWidth = window.innerWidth;
    node.textContent = JSON.stringify(report).replace(/</g, "\\u003c");
  }
  function add(list, entry) {
    if (list.length < limit) { list.push(entry); }
    write();
  }
  function addRequest(url, reason) {
    for (var index = 0; index < report.requests.length; index += 1) {
      if (report.requests[index].url === url) { return; }
    }
    add(report.requests, { url: clip(url), reason: clip(reason) });
  }
  ["error", "warn"].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      add(report.console, { level: level, message: clip(Array.prototype.map.call(arguments, describe).join(" ")) });
      return original.apply(console, arguments);
    };
  });
  window.addEventListener("error", function (event) {
    var target = event.target;
    if (target instanceof Element) {
      var tag = target.tagName.toLowerCase();
      addRequest(target.getAttribute("src") || target.getAttribute("href") || tag, "failed to load " + tag);
      return;
    }
    var message = (event.error && event.error.stack) || event.message || "Script error";
    var entry = { message: clip(message) };
    if (event.filename) { entry.source = clip(event.filename + ":" + event.lineno + ":" + event.colno); }
    add(report.errors, entry);
  }, true);
  window.addEventListener("unhandledrejection", function (event) {
    add(report.errors, { message: clip("Unhandled promise rejection: " + describe(event.reason)) });
  });
  document.addEventListener("securitypolicyviolation", function (event) {
    addRequest(event.blockedURI || "inline", "blocked by the artifact sandbox (" + event.effectiveDirective + ")");
  });
  document.addEventListener("DOMContentLoaded", write);
  window.addEventListener("load", function () { write(); requestAnimationFrame(write); setTimeout(write, 300); });
  write();
})();</script>`;
}

export function buildPreviewDocument(params: {
  html: string;
  css?: string;
  reportId: string;
}): string {
  return (
    hardenSandboxDocument(
      buildSandboxDocument(HTML_SANDBOX_TEMPLATE, params.html, params.css),
      buildCaptureScript(params.reportId),
    ) ?? ""
  );
}

export function readPreviewReport(content: string, reportId: string): PreviewReport | null {
  const marker = content.indexOf(`id="${reportId}"`);

  if (marker === -1) {
    return null;
  }

  const start = content.indexOf(">", marker);
  const end = content.indexOf("</script>", start);

  if (start === -1 || end === -1) {
    return null;
  }

  const parsed = previewReportSchema.safeParse(
    safeParseJson<unknown>(content.slice(start + 1, end)),
  );

  return parsed.success ? parsed.data : null;
}
