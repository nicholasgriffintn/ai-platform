import { isSafeLinkUrl } from "./safe-url";

const ALLOWED_TAGS = new Set([
  "a",
  "article",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "dd",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const DISCARDED_TAGS = new Set([
  "base",
  "embed",
  "form",
  "iframe",
  "link",
  "math",
  "meta",
  "noscript",
  "object",
  "script",
  "style",
  "svg",
  "template",
]);

const ALLOWED_ATTRIBUTES = new Set([
  "alt",
  "class",
  "colspan",
  "dir",
  "href",
  "lang",
  "rowspan",
  "src",
  "title",
]);

const URL_ATTRIBUTES = new Set(["href", "src"]);

const sanitiseElement = (element: Element): void => {
  const tagName = element.tagName.toLowerCase();

  if (DISCARDED_TAGS.has(tagName)) {
    element.remove();

    return;
  }

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    const isAllowed =
      ALLOWED_ATTRIBUTES.has(name) && (!URL_ATTRIBUTES.has(name) || isSafeLinkUrl(attribute.value));

    if (!isAllowed) {
      element.removeAttribute(attribute.name);
    }
  }

  for (const child of Array.from(element.children)) {
    sanitiseElement(child);
  }

  if (!ALLOWED_TAGS.has(tagName)) {
    element.replaceWith(...Array.from(element.childNodes));
  }
};

export const createSanitisedFragment = (html: string, doc: Document): DocumentFragment => {
  const parsed = new DOMParser().parseFromString(html, "text/html");

  for (const child of Array.from(parsed.body.children)) {
    sanitiseElement(child);
  }

  const fragment = doc.createDocumentFragment();

  for (const node of Array.from(parsed.body.childNodes)) {
    fragment.append(doc.importNode(node, true));
  }

  return fragment;
};
