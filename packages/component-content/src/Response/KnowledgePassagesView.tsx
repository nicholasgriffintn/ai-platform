import { projectKnowledgeSearchResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { isHttpUrl, isRecord } from "@ngriffin_uk/polychat-utility-core";

import { MemoizedMarkdown } from "../markdown";

export function KnowledgePassagesView({ data }: { data: unknown }) {
  const parsed = projectKnowledgeSearchResponseSchema.shape.data
    .max(10)
    .safeParse(isRecord(data) ? data.documents : undefined);

  if (!parsed.success) {
    return <p className="text-sm text-muted-foreground">Knowledge results unavailable.</p>;
  }

  if (!parsed.data.length) {
    return <p className="text-sm text-muted-foreground">No matching knowledge passages.</p>;
  }

  return (
    <div className="space-y-3" data-responsetype="document-search">
      {parsed.data.map((document) => (
        <article key={document.chunkId} className="rounded-md border border-border p-3">
          <h3 className="text-sm font-medium">{document.title}</h3>
          <MemoizedMarkdown className="mt-2 max-w-none text-sm">
            {document.content}
          </MemoizedMarkdown>
          {document.provenance.externalUri && isHttpUrl(document.provenance.externalUri) ? (
            <a
              href={document.provenance.externalUri}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs underline"
            >
              Open source
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}
