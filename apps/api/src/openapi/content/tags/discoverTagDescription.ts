import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const discoverTagDescription = md`
# Discover

Discover is a daily edition Poly writes for you each morning from the topics you follow. Turn it on with \`PATCH /discover/settings\`, then read it with \`GET /discover\` or a past day with \`GET /discover/editions/{date}\`.

- \`POST /discover/feedback\` tells it more, less or hide on a card, which shapes later editions.
- \`/discover/follows\` follows and unfollows topics. Card actions check how an article is framed or compare how outlets covered a topic.
- An edition can become a listen (The Perch), a weekly recap, or an illustrated, narrated episode in a season on your top topic.
- \`/discover/wind-down\` makes guided wind-down sessions with shared sound beds.
`;
