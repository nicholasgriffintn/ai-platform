import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const sourcesTagDescription = md`
# Sources

Source material for retrieval, personal or project-scoped. Group sources into collections, search a project's knowledge, and keep connector content fresh with knowledge syncs you can pause, resume or refresh.

\`PATCH /sources/project_context\` sets which sources form a project's standing context.

Sources are also the media library. Images, audio and video keep their file; audio and video can be transcribed (\`POST /sources/{source_id}/transcribe\`), summarised into notes and given cover art, and the transcript becomes searchable content.

- \`POST /sources/generations\` generates images, video or model output into sources, from Image Studio's multi-model runs or a single Replicate model. Each run is a source that stays \`processing\` until its media arrives.
- \`POST /sources/drawings\` paints a sketch into an image source.
- \`POST /sources/podcasts\` turns sources or research into a two-host podcast episode with a transcript, show notes and cover art.
- Podcast shows are collections of kind \`podcast\`. \`POST /sources/collections/{collection_id}/feed\` issues a private RSS feed link that podcast apps can subscribe to.
`;
