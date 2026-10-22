import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const experiencesTagDescription = md`
# Experiences

Single-purpose apps that sit beside Chat. Which ones a person or project has enabled comes from \`/capabilities\`.

- \`/experiences/notes\` keeps notes, drafts them from audio or video URLs and formats them.
- \`/experiences/drawings\` turns a sketch into an image, or guesses what it shows.
- \`/experiences/strudel\` generates, saves and rates Strudel patterns.
- \`/experiences/articles\` extracts articles from URLs and reports across them.
- \`/experiences/recordings\` takes an audio file or URL for transcription.
- \`/experiences/twenty_questions\` plays against a sealed secret with calibrated yes probabilities.
- \`/experiences/verbatim/segments\` transcribes live audio, then verifies every word against it.
- \`/experiences/forecasts\` forecasts time series with Timestral and returns quantile ranges.
- \`/experiences/canvas/models\` and \`/experiences/replicate/models\` list models for those experiences. Their generations run as \`/jobs\`.
`;
