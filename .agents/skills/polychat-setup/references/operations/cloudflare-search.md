# Configure Cloudflare search

**Search needs current evidence and a predictable source boundary.** Use Cloudflare Web Search for the open web and AI Search for an approved public knowledge corpus. Both extend the existing search registry, saved `search_provider` preference, `web_search` tool, deep search answer synthesis and source citations.

## Enable Web Search

- Set `ACCOUNT_ID` to the Cloudflare account containing our existing `llm-assistant` AI Gateway.
- Set the secret `CLOUDFLARE_WEB_SEARCH_TOKEN` to an account-scoped token with **Workers AI:Read** and **AI Gateway:Read**. Keep it separate from `AI_GATEWAY_TOKEN`, which authenticates a different API.
- Load AI Gateway credits or configure a provider key in that gateway. Set `CLOUDFLARE_WEB_SEARCH_BYOK_ALIAS` to require an operator-owned gateway key. An unknown alias must fail rather than spend credits.
- Set `CLOUDFLARE_WEB_SEARCH_PROVIDER` to `ceramic` (default), `exa` or `linkup`. Requests may override the provider with `options.cloudflare_provider`. The gateway and key alias stay under operator control.
- Select **Cloudflare Web Search** in account settings, or send `searchProvider: "cloudflare"` to `/apps/retrieval/web-search`.

```json
{
  "query": "Recent changes to Cloudflare Workers",
  "searchProvider": "cloudflare",
  "options": { "cloudflare_provider": "ceramic", "max_results": 5 }
}
```

Require a Pro account for these platform-funded providers. A user-stored key named `cloudflare` does not grant access to platform credits or gateway aliases. Keep the existing direct Exa provider when a user wants their own Polychat-stored Exa key or Exa-specific options.

Expect at most 10 results and a 1,024-character query. Web Search returns snippets, not full pages or generated answers. Our existing model generates the answer from those snippets. Forward provider failures as errors before answer generation.

## Enable public knowledge retrieval

- Create an AI Search instance for public documentation or another deliberately public website corpus. Use the namespaced GA API rather than legacy `autorag` endpoints.
- Define custom metadata `{ "field_name": "is_public", "data_type": "boolean" }` and mark approved pages with `<meta name="is_public" content="true">`. Re-index the source after changing metadata configuration.
- Set `CLOUDFLARE_AI_SEARCH_TOKEN` to a separate account-scoped secret with the documented **AI Search:Edit** and **AI Search:Run** permissions.
- Set `CLOUDFLARE_AI_SEARCH_INSTANCE` and optionally `CLOUDFLARE_AI_SEARCH_NAMESPACE` (default `default`). Connect the instance's model operations to the existing AI Gateway in Cloudflare's dashboard.
- Set `CLOUDFLARE_AI_SEARCH_ALLOWED_ORIGINS` to comma-separated public HTTPS origins, such as `https://docs.example.com,https://help.example.com`.
- Select **Cloudflare Knowledge Search** in account settings, or send `searchProvider: "cloudflare-ai-search"`. Set `options.retrieval_type` to `hybrid` (default), `vector` or `keyword`.

Filter retrieval with `is_public: true` and check each returned chunk again for that metadata and an exact approved origin. Return only text chunks with public HTTPS item keys, retaining their chunk IDs and relevance scores. Disable similarity caching for these requests so results always pass the current source checks.

**Keep private retrieval in the existing authorised document path.** Do not point this integration at the private assets bucket or label private documents public. `search_documents` continues to use its owned, active document records and existing Vectorize/S3Vectors/Bedrock targets. Extending AI Search to private material requires an explicit ingestion/deletion lifecycle, trusted tenant scoping and repository ownership checks before passages enter model context.

## Choose the integration

Prefer Ceramic for inexpensive general web grounding, the existing direct Exa integration for personal BYOK, and AI Search for a curated public documentation corpus. Add further search implementations through `packages/ai-providers` and keep request/response contracts in `packages/schemas`. No dependency, database migration or private asset re-index is required by this change.

Cloudflare announced Web Search in beta on 2 October 2026 and AI Search GA on 1 October. AI Search billing is scheduled to start on 1 November 2026. Check current provider pricing and retention terms before enabling a paid corpus: the launch blog and provider documentation disagree on Exa's Zero Data Retention status.

Validate with mocked API contract and boundary tests before deploying. Live operation still requires operator tokens, gateway credits or keys, an indexed public corpus and metadata configuration. Do not publish, provision resources or submit paid queries as routine validation.

Sources: [Web Search usage and response contract](https://developers.cloudflare.com/web-search/how-to-use/), [providers and pricing](https://developers.cloudflare.com/web-search/providers/), [AI Search GA](https://blog.cloudflare.com/ai-search-ga/), [AI Search REST API](https://developers.cloudflare.com/ai-search/api/search/rest-api/), [metadata](https://developers.cloudflare.com/ai-search/configuration/indexing/metadata/), [filtering](https://developers.cloudflare.com/ai-search/configuration/retrieval/filtering/).
