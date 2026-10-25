import { htmlToPlainText } from "./html-text.js";

export interface SyndicationItem {
  title: string;
  url: string;
  summary: string;
  publishedAt: string | null;
}

export interface SyndicationFeed {
  title: string;
  items: SyndicationItem[];
}

interface Element {
  tag: string;
  inner: string;
}

const CDATA_OPEN = "<![CDATA[";
const CDATA_CLOSE = "]]>";

function isNameBoundary(character: string | undefined): boolean {
  return (
    character === ">" ||
    character === "/" ||
    character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\r"
  );
}

function findElements(xml: string, name: string): Element[] {
  const elements: Element[] = [];
  const open = `<${name}`;
  const close = `</${name}>`;
  let index = xml.indexOf(open);

  while (index !== -1) {
    if (!isNameBoundary(xml[index + open.length])) {
      index = xml.indexOf(open, index + open.length);
      continue;
    }

    const tagEnd = xml.indexOf(">", index);

    if (tagEnd === -1) {
      break;
    }

    const tag = xml.slice(index, tagEnd + 1);

    if (tag.endsWith("/>")) {
      elements.push({ tag, inner: "" });
      index = xml.indexOf(open, tagEnd + 1);
      continue;
    }

    const end = xml.indexOf(close, tagEnd + 1);

    if (end === -1) {
      break;
    }

    elements.push({ tag, inner: xml.slice(tagEnd + 1, end) });
    index = xml.indexOf(open, end + close.length);
  }

  return elements;
}

function readAttribute(tag: string, name: string): string | null {
  for (const quote of ['"', "'"]) {
    const marker = ` ${name}=${quote}`;
    const start = tag.indexOf(marker);

    if (start !== -1) {
      const valueStart = start + marker.length;
      const valueEnd = tag.indexOf(quote, valueStart);

      return valueEnd === -1 ? null : htmlToPlainText(tag.slice(valueStart, valueEnd));
    }
  }

  return null;
}

function unwrapCharacterData(value: string): string {
  let text = "";
  let index = 0;

  while (index < value.length) {
    const start = value.indexOf(CDATA_OPEN, index);

    if (start === -1) {
      text += value.slice(index);
      break;
    }

    const end = value.indexOf(CDATA_CLOSE, start + CDATA_OPEN.length);

    text += value.slice(index, start);

    if (end === -1) {
      text += value.slice(start + CDATA_OPEN.length);
      break;
    }

    text += value
      .slice(start + CDATA_OPEN.length, end)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;");
    index = end + CDATA_CLOSE.length;
  }

  return text;
}

function readText(xml: string, ...names: readonly string[]): string {
  for (const name of names) {
    const [element] = findElements(xml, name);

    if (element) {
      const text = htmlToPlainText(htmlToPlainText(unwrapCharacterData(element.inner)));

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function readLink(xml: string): string {
  const links = findElements(xml, "link");
  const alternate = links.find((link) => {
    const rel = readAttribute(link.tag, "rel");

    return readAttribute(link.tag, "href") && (rel === null || rel === "alternate");
  });
  const href = alternate ? readAttribute(alternate.tag, "href") : null;

  if (href) {
    return href;
  }

  const text = links.map((link) => htmlToPlainText(unwrapCharacterData(link.inner))).find(Boolean);

  if (text) {
    return text;
  }

  const [guid] = findElements(xml, "guid");

  return guid && readAttribute(guid.tag, "isPermaLink") !== "false"
    ? htmlToPlainText(unwrapCharacterData(guid.inner))
    : "";
}

function readPublishedAt(xml: string): string | null {
  const value = readText(xml, "pubDate", "published", "dc:date", "updated");
  const time = value ? Date.parse(value) : Number.NaN;

  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function readItem(xml: string, base: string | null): SyndicationItem | null {
  const link = readLink(xml);
  let url: string;

  if (!link) {
    return null;
  }

  try {
    url = new URL(link, base ?? undefined).toString();
  } catch {
    return null;
  }

  const title = readText(xml, "title") || url;

  return {
    title,
    url,
    summary: readText(xml, "description", "summary", "content:encoded", "content"),
    publishedAt: readPublishedAt(xml),
  };
}

export function parseSyndicationFeed(xml: string, base: string | null = null): SyndicationFeed {
  const entries = [...findElements(xml, "item"), ...findElements(xml, "entry")];
  const firstEntry = Math.min(
    ...["<item", "<entry"].map((open) => {
      const index = xml.indexOf(open);

      return index === -1 ? xml.length : index;
    }),
  );

  return {
    title: readText(xml.slice(0, firstEntry), "title"),
    items: entries.flatMap((entry) => readItem(entry.inner, base) ?? []),
  };
}
