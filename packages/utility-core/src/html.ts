export interface HtmlSpan {
  index: number;
  length: number;
  body: string;
}

export function listHtmlComments(text: string): HtmlSpan[] {
  const comments: HtmlSpan[] = [];
  let from = 0;

  for (;;) {
    const start = text.indexOf("<!--", from);

    if (start === -1) {
      break;
    }

    const end = text.indexOf("-->", start + 4);

    if (end === -1) {
      break;
    }

    comments.push({ index: start, length: end + 3 - start, body: text.slice(start + 4, end) });
    from = end + 3;
  }

  return comments;
}

export function listHtmlTags(text: string): HtmlSpan[] {
  const tags: HtmlSpan[] = [];
  let from = 0;
  let end = -1;

  for (;;) {
    const start = text.indexOf("<", from);

    if (start === -1) {
      break;
    }

    if (end <= start) {
      end = text.indexOf(">", start + 1);
    }

    if (end === -1) {
      break;
    }

    const nextOpen = text.indexOf("<", start + 1);

    if (nextOpen !== -1 && nextOpen < end) {
      from = nextOpen;
      continue;
    }

    tags.push({ index: start, length: end + 1 - start, body: text.slice(start + 1, end) });
    from = end + 1;
  }

  return tags;
}
