# Knowledge and connected investigation

Polychat can search project Sources, refresh selected Confluence pages and produce a service incident brief through existing recipes. Keep Sources as input and save briefs as governed document Outputs in Files.

## Search project knowledge

Use Files → Given in a project, or enable `search_documents` in a project conversation. Keyword retrieval uses D1 FTS5; semantic retrieval uses the platform Workers AI model and Vectorize binding. Hydrate every vector match from the current authorised Source revision, then combine keyword and semantic rankings.

```ts
import { searchProjectKnowledge } from "@ngriffin_uk/polychat-library-client";

const passages = await searchProjectKnowledge({
  projectId,
  query: "How do we roll back the API deployment?",
  top_k: 10,
});
```

Return source and chunk IDs, local revisions and original URLs. Confluence passages also carry the upstream version and last successful page ingestion time. Editing, archiving or deleting a Source immediately excludes old revisions from retrieval; asynchronous cleanup removes their vectors later.

Apply migrations `0058_source_knowledge.sql` and `0059_confluence_knowledge_sync.sql` through the normal authorised migration process before enabling this release. The API task queue and existing cron dispatch indexing. Bind `AI` and `VECTOR_DB` and retain a stable `EMBEDDING_SCOPE_SECRET` for semantic search; keyword search works after indexing when semantic bindings are unavailable. This implementation does not index personal credentials or select a member's private vector store.

## Refresh selected Confluence pages

Enable the **Confluence Project Knowledge** recipe in the destination project and connect Confluence. In its project conversation, choose the published page IDs and refresh interval, then let the assistant discover and test the current page-read schema. The sync copies the selected page text into project Files for project members.

Pass the discovery's opaque `connectionReferenceId` and the tested arguments, rather than a token or guessed vendor field names:

```ts
import { createKnowledgeSync } from "@ngriffin_uk/polychat-library-client";

await createKnowledgeSync({
  projectId,
  title: "API runbooks",
  connectionId: discovery.connectionReferenceId,
  intervalMinutes: 60,
  pages: selectedPages.map((page) => ({
    pageId: page.id,
    readParameters: page.validatedReadParameters,
  })),
});
```

Use Files → Given to review freshness, pause, resume or request a refresh. Only the connecting owner can control a sync. Pause retains the copied Sources; delete a Source separately when removing copied material. Selected pages are immutable for that sync; pause it and create another selection when the set changes.

Each job reads at most ten pages, commits the Source and checkpoint atomically, and resumes after the last durable page. Exact account ownership, project membership and the enabled recipe are rechecked around every read. Fenced leases prevent a paused or superseded job from updating Sources. Explicit removal states archive a page; a denied or missing read archives its existing copy, retains the checkpoint and reports an error instead of claiming a successful full refresh. Transient failures retain the checkpoint and prior complete-sync time. Access failures pause the sync until its owner restores access and resumes it.

Creation and manual refresh enqueue immediately, with cron recovery if dispatch fails. The requested interval is a minimum: the deployed cron cadence determines when a due sync runs (the example manifest runs every fifteen minutes), and large selections may require several jobs. The integration supports Confluence Cloud published storage bodies and page versions; attachments, whole-space crawling and other body formats need separate adapters. Read the [Atlassian page contract](https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-pages-id-get) when extending normalisation.

## Investigate a mapped service

Configure **Service Incident Brief** with a service name, environment and a 1–168 hour window. Map at least one of PagerDuty service ID, Sentry organisation/project or GitHub owner/repository. Partial provider mappings are rejected; unmapped providers and write operations are denied.

The recipe discovers current schemas through the existing connector gateway, uses the saved resource mapping and server-generated UTC window, searches project runbooks and saves a cited brief with `write_document`. Include impact, observations, a timestamped timeline, recent changes, supported hypotheses, missing evidence and next checks. Environment and time filters depend on the discovered vendor schema; label unfiltered results and leave unrelated evidence out of the timeline. A correlated deployment is evidence to investigate, not proof of cause.

Use existing recipe scheduling and project tasks for recurring or delegated investigations. Keep missing credentials and unavailable sources visible; do not invent a complete incident picture.

## Connect authenticated hosted MCP

Save a connection from the MCP capability configuration dialog. Supply a public HTTPS gateway URL, bearer token and exact allowed tool names, and explicitly consent to OpenAI receiving the token to contact that endpoint. Choose the saved connection in the capability or teammate editor.

Store encrypted credentials separately from configurations. Bind decryption to the owner, endpoint and saved recipient; resolve the credential only at the outbound provider boundary. Require approval for every hosted MCP operation and fail closed on incompatible providers, other owners, changed endpoints or tool access outside the saved list.

Authenticated calls disable gateway payload logging and caching using [Cloudflare's logging controls](https://developers.cloudflare.com/ai-gateway/observability/logging/) and [cache controls](https://developers.cloudflare.com/ai-gateway/features/caching/). Provider errors omit response bodies; known credentials are redacted from buffered and streaming responses. Credentials are sent to OpenAI and the configured endpoint under the saved consent. Changing `JWT_SECRET` requires reconnection.

This extension supports saved bearer tokens with native OpenAI hosted MCP. It does not establish a tunnel to a private network or refresh OAuth tokens. Deploy a reachable HTTPS gateway yourself for an internal service and keep its tool allowlist narrow.
