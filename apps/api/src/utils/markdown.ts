/**
 * Markdown to HTML converter
 * @param markdown Markdown text to convert
 * @returns HTML representation of the markdown
 */
export function convertMarkdownToHtml(markdown: string): string {
  // Process code blocks first
  let html = markdown.replace(/```([^`]+)```/g, "<pre><code>$1</code></pre>");

  // Process inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Process headers
  html = html
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^#### (.*$)/gm, "<h4>$1</h4>")
    .replace(/^##### (.*$)/gm, "<h5>$1</h5>")
    .replace(/^###### (.*$)/gm, "<h6>$1</h6>");

  // Process blockquotes
  html = html.replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>");

  // Process lists
  html = html
    .replace(/^\* (.*$)/gm, "<ul><li>$1</li></ul>")
    .replace(/^- (.*$)/gm, "<ul><li>$1</li></ul>")
    .replace(/^[0-9]+\. (.*$)/gm, "<ol><li>$1</li></ol>");

  // Fix adjacent list items (remove duplicate ul/ol tags)
  html = html.replace(/<\/ul>\s*<ul>/g, "").replace(/<\/ol>\s*<ol>/g, "");

  // Process emphasis and strong
  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");

  // Process images
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');

  // Process links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

  // Process paragraphs (skip if already in a block element)
  html = html.replace(/^\s*(\n)?(.+)/gm, (m) => {
    return /^<(\/)?((h[1-6])|ul|ol|li|blockquote|pre|img|p)/.test(m)
      ? m
      : `<p>${m}</p>`;
  });

  // Handle line breaks
  html = html.replace(/\n/g, "<br>");

  return html;
}
