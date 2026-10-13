import { extractFencedBlock } from "../answers.js";

export const MAX_HTML_ARTEFACT_BYTES = 40_000;

const DOCUMENT_START = /<!doctype html|<html[\s>]/i;
const DOCUMENT_END = /<\/html>/i;
const DRAWING_SURFACE = /<svg[\s>]|<canvas[\s>]/i;
const ANIMATION =
  /@keyframes|animation\s*:|animation-name|<animate|<animatetransform|<animatemotion|requestanimationframe|setinterval|\.animate\s*\(/i;
const NETWORK = [
  /\b(?:src|href|action|poster|data)\s*=\s*["']?\s*(?:https?:)?\/\//i,
  /url\(\s*["']?\s*(?:https?:)?\/\//i,
  /@import/i,
  /\bfetch\s*\(/i,
  /XMLHttpRequest|WebSocket|EventSource|sendBeacon/i,
  /\bimport\s*\(/i,
  /<(?:iframe|object|embed|base|link|meta)[\s>]/i,
];

export interface HtmlArtefactCheck {
  ok: boolean;
  reasons: string[];
}

export function extractHtmlDocument(output: string): string | null {
  const fenced = extractFencedBlock(output, ["html"]);
  const source = fenced ?? output;
  const start = source.search(DOCUMENT_START);

  if (start === -1) {
    const trimmed = source.trim();

    return trimmed.startsWith("<") ? trimmed : null;
  }

  const endMatch = DOCUMENT_END.exec(source.slice(start));

  return endMatch
    ? source.slice(start, start + endMatch.index + endMatch[0].length).trim()
    : source.slice(start).trim();
}

export function checkHtmlArtefact(html: string): HtmlArtefactCheck {
  const reasons: string[] = [];

  if (new TextEncoder().encode(html).length > MAX_HTML_ARTEFACT_BYTES) {
    reasons.push("over 40 KB");
  }

  if (!DRAWING_SURFACE.test(html)) {
    reasons.push("no SVG or canvas");
  }

  if (!ANIMATION.test(html)) {
    reasons.push("nothing animates");
  }

  if (NETWORK.some((pattern) => pattern.test(html))) {
    reasons.push("reaches for the network");
  }

  return { ok: reasons.length === 0, reasons };
}
