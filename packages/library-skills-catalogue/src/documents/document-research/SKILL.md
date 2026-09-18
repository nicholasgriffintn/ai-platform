---
name: document-research
description: >-
  Investigate a question across the user's uploaded documents and saved content by searching repeatedly, following evidence, and reconciling passages. Load when the answer depends on comparing, tracing, or verifying material across one or more of the user's documents; do not load for general web research or a simple lookup already answered by one passage.
metadata:
  polychat-display-name: Document research
  polychat-category: Research
  polychat-tags: "documents, retrieval, evidence, rag"
  polychat-suggests-tools: "search_documents"
---

# Document research

Use the user's documents as the evidence base. `search_documents` retrieves passages from uploaded documents and saved content; it does not search the web and it does not prove that you have read a whole document.

This skill owns the method for investigating that evidence. The `research` tool is a separate paid capability for deep web research and should not receive private document passages.

## Decide how much retrieval is warranted

A direct lookup needs one search when a clear passage answers the question. Do not manufacture a research loop for a fact the first result settles.

Use iterative research when the question requires you to:

- compare claims from more than one document;
- trace a conclusion to supporting passages;
- reconcile conflicting figures or descriptions;
- find evidence spread across sections or sources; or
- verify that an apparent answer survives a differently phrased search.

## Search deliberately

Start with the user's question in natural language. Read every returned passage before deciding what the next search should resolve.

For each additional search, name the evidence gap internally and change the query to target it. Useful refinements include a named entity, date, section, disputed term, or wording taken from a promising passage. Do not repeat the same query merely to ask for another sample.

Search again only when another pass can answer a specific unresolved point. Stop when:

- the evidence is sufficient to answer;
- new searches repeat passages you have already seen;
- results are consistently weak or unrelated; or
- the remaining uncertainty is not present in the available documents.

If the first search finds nothing, reformulate the query once around the central concept or a likely document term. If that also finds nothing, say that the available documents did not support an answer. Do not fill the gap from memory.

## Handle evidence honestly

- Distinguish what a passage states from what you infer across passages.
- Cite the exact document title returned by the tool for every material claim. If a passage has no title, identify it as untitled rather than inventing one.
- Quote only where the precise wording matters; otherwise paraphrase faithfully.
- Preserve dates, units, qualifiers, and scope when comparing figures.
- When sources conflict, show the disagreement and explain which evidence carries more weight instead of silently choosing one.
- Never imply that an omitted section agrees with the retrieved passages.

If outside information is also needed, keep it visibly separate from the private-document evidence. Never pass private passage text to web search or a deep-research provider.

## Report the result

Lead with the answer. Follow with the supporting evidence grouped by finding rather than by search call. End with any material gap, conflict, or limitation that could change the conclusion.

Do not narrate routine searches. Explain the retrieval path only when it helps the user judge the result or understand why the documents were insufficient.
