import { describe, expect, it } from "vitest";

import { markdownToHtml } from "./markdown";

describe("markdownToHtml", () => {
	it("renders headings, lists, inline styles, and links", () => {
		const html = markdownToHtml(`# Title

- **First**
- _Second_

[Docs](https://example.com/docs)`);

		expect(html).toBe(`<h1>Title</h1>
<ul>
<li><strong>First</strong></li>
<li><em>Second</em></li>
</ul>
<p><a href="https://example.com/docs">Docs</a></p>`);
	});

	it("escapes raw HTML in text and code blocks", () => {
		const html = markdownToHtml(`<script>alert("x")</script>

\`\`\`
<img src=x onerror=alert(1)>
\`\`\``);

		expect(html).not.toContain("<script>");
		expect(html).not.toContain("<img");
		expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
		expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
	});

	it("renders image markdown before link markdown", () => {
		const html = markdownToHtml("![Example](https://example.com/image.png)");

		expect(html).toBe('<p><img src="https://example.com/image.png" alt="Example"></p>');
	});

	it("removes unsafe link and image URLs", () => {
		const html = markdownToHtml(
			"[Bad](javascript:alert(1)) ![Bad image](data:text/html,<script>alert(1)</script>)",
		);

		expect(html).toBe("<p>Bad Bad image</p>");
	});
});
