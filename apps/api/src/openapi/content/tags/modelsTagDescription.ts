import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const modelsTagDescription = md`
# Models

Discover the models you can run, with their capabilities and pricing.

- \`GET /models\` lists models the caller can use, including models on their own provider keys. Filter by \`capability\`, input \`modality\` or \`output\` modality, and page with \`limit\` and \`after\`.
- \`GET /models/catalogue\` lists every model the platform knows about, without filtering by access.
- \`GET /models/{model_id}\` returns one model.
- \`GET /models/artificial_analysis\` returns cached Artificial Analysis benchmark, arena, pricing and performance data with source attribution.

## Tiers

Instead of naming a model, pass \`model_tier\` (\`low\`, \`medium\`, \`high\` or \`ultra\`) to \`POST /responses\` or \`POST /chat/completions\`. Polychat picks the model for that tier from the caller's plan. \`GET /models/tiers\` shows which model each tier and role resolves to for the caller on each runtime.

## Examples

~~~bash
curl "https://api.polychat.app/models?modality=vision" \\
  -H "Authorization: Bearer YOUR_TOKEN"
~~~

~~~bash
curl https://api.polychat.app/models/tiers \\
  -H "Authorization: Bearer YOUR_TOKEN"
~~~
`;
