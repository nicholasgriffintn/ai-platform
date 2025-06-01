function downgradeH1Headings(markdown: string): string {
  return markdown.replace(/^# (.*)$/gm, "## $1");
}

export function fixMarkdown(markdown: string): string {
  return downgradeH1Headings(markdown);
}
