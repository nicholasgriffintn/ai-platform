import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const extractionsTagDescription = md`
# Extractions

Typed values from a System One extraction model (Cloudflare Clairic). Send a \`state\` and a map
of named \`fields\`; each answer is a value of the declared type or \`null\` when the input does not
say. Text answers carry a \`span\` into the state, scalar answers carry \`p_null\` and
\`confidence\`, and estimates and forecasts carry a median and an 80% interval (\`p10\` to \`p90\`).

Attach up to four PNG, JPEG or WebP \`images\` as base64 data URLs to read receipts, forms or
screenshots alongside the text. Pass \`reference_date\` so dates written without a year resolve.
`;
