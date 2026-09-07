# ADR 0009: Bound live streams and page durable history

Status: Implemented.

## Problem

A long response can deliver thousands of text deltas, an unterminated event can grow until the process runs out of memory, and one tool result can contain megabytes of provider data. Persisted conversations also loaded every retained message at once. These paths could monopolise the browser or iPhone main thread, delaying stop controls and authoritative terminal state.

## Decision

Keep durable messages complete, but bound their live transport and presentation. Stream parsers reject any single event above 4 MiB and enter the exact-run recovery path instead of fabricating completion. The API emits at most a 64 KiB tool-result event, with up to 32 KiB of content plus the identifiers, presentation data and interaction state needed during the run. Persist the full tool message before emitting its preview.

Coalesce supersedable text progress to one presentation update per display interval. Flush pending text before tool, interaction, metadata, error and terminal boundaries, and yield the main thread after 64 consecutive progress events. Render stored text outputs above 40 KiB, JSON branches above 100 entries and tables above 100 rows as expandable previews.

Load the newest 100 visible messages for authenticated conversation detail and fetch earlier pages through the existing authorised endpoint using an exact oldest-message cursor, deduplicating overlap and retaining transcript order. The limit is a client memory and rendering window, not a retention policy.

## Consequences

Large live outputs no longer determine control latency, and an oversized or malformed event cannot create a false complete transcript. Reopening a conversation replaces a live preview with its complete stored message, and users explicitly expand expensive output. A single legitimate event above 4 MiB requires run recovery. Real-device memory, thermal and VoiceOver behaviour remain release checks because simulator and desktop measurements do not represent them.
