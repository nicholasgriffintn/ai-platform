export function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  let html = "";
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        html += "<pre><code>";
        inCodeBlock = true;
      } else {
        html += "</code></pre>\n";
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      html += `${line}\n`;
      continue;
    }

    if (!line) continue;

    if (line.trim() === "") {
      html += "\n";
      continue;
    }

    if (line.startsWith("# ")) {
      html += `<h1>${line.substring(2)}</h1>\n`;
    } else if (line.startsWith("## ")) {
      html += `<h2>${line.substring(3)}</h2>\n`;
    } else if (line.startsWith("### ")) {
      html += `<h3>${line.substring(4)}</h3>\n`;
    } else if (line.startsWith("#### ")) {
      html += `<h4>${line.substring(5)}</h4>\n`;
    } else if (line.startsWith("##### ")) {
      html += `<h5>${line.substring(6)}</h5>\n`;
    } else if (line.startsWith("###### ")) {
      html += `<h6>${line.substring(7)}</h6>\n`;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const prevLine = i > 0 ? lines[i - 1] : "";
      if (!prevLine.startsWith("- ") && !prevLine.startsWith("* ")) {
        html += "<ul>\n";
      }
      html += `<li>${processInlineMarkdown(line.substring(2))}</li>\n`;

      const nextLine = i < lines.length - 1 ? lines[i + 1] : "";
      if (!nextLine.startsWith("- ") && !nextLine.startsWith("* ")) {
        html += "</ul>\n";
      }
    } else if (/^\d+\. /.test(line)) {
      const prevLine = i > 0 ? lines[i - 1] : "";
      if (!/^\d+\. /.test(prevLine)) {
        html += "<ol>\n";
      }
      html += `<li>${processInlineMarkdown(line.replace(/^\d+\. /, ""))}</li>\n`;

      const nextLine = i < lines.length - 1 ? lines[i + 1] : "";
      if (!/^\d+\. /.test(nextLine)) {
        html += "</ol>\n";
      }
    } else if (line.startsWith(">")) {
      html += `<blockquote>${processInlineMarkdown(line.substring(1).trim())}</blockquote>\n`;
    } else if (line.trim() === "---" || line.trim() === "***") {
      html += "<hr>\n";
    } else {
      html += `<p>${processInlineMarkdown(line)}</p>\n`;
    }
  }

  if (!html) return "";

  return html.trim();
}

function processInlineMarkdown(text: string): string {
  let newText = text;
  newText = newText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  newText = newText.replace(/__(.*?)__/g, "<strong>$1</strong>");

  newText = newText.replace(/\*(.*?)\*/g, "<em>$1</em>");
  newText = newText.replace(/_(.*?)_/g, "<em>$1</em>");

  newText = newText.replace(/`(.*?)`/g, "<code>$1</code>");

  newText = newText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  newText = newText.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1">',
  );

  return newText;
}
