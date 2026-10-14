import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const adminTagDescription = md`
# Admin

Operator-only routes. Every route here requires an admin account.

- Set a plan's included credits, grace credits and Stripe metering.
- Queue the refresh of cached Artificial Analysis model data.

Other admin actions, such as marketplace moderation and official benchmark runs, live with the resource they act on.
`;
