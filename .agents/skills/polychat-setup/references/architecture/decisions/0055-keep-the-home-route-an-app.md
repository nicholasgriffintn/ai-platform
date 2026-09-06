# ADR 0055: Keep the home route an app and put the tour beneath it

Status: Accepted.

This decision defines where product explanation lives on the web application and what it may cost the people who do not need it. The Discover module under `apps/app/src/components/Discover`, the `/discover` route and the sidebar Discover segment implement it.

Polychat's home route was the conversation welcome and nothing else. A returning member wants exactly that. A stranger arriving from a link saw a composer with no account of what the product is, and every explanation lived in a pricing page they had no reason to open. A separate marketing site would fix the second problem by breaking the first: the composer that works before sign-in is the differentiator, and a brochure in front of it would hide it.

## Decision

The home route stays the application. For a guest with no conversation open, a tour renders beneath the welcome screen, in the same scroll container, after the fold. Nothing promotional sits above the composer. The tour is absent for members and for guests once a conversation exists, because the welcome screen itself is absent then.

The tour is one module of bands, each fed by data the application already loads: the model registry, the capability catalogue, the plan list and the pet lore. Bands never carry screenshots or a second copy of a number, so they cannot drift from the product. The same bands render on `/discover` as a standalone page with anchors per band, so any band can be linked to directly and indexed. The module is loaded lazily from the home route so the composer's time to interactive does not move.

Navigation reaches the tour through a Discover segment: on the standard sidebar for every visitor, and on the chat sidebar for guests only, where a member's conversation list must not be pushed down by links they have already read.

Copy stays in the house voice recorded for the welcome generator: dry, specific, no exclamation marks, and never ahead of what the product does.

## Trade-off

A guest's first page is longer and makes six more requests once they scroll, although none block the composer. The bands describe the product in prose that must be edited when features change, unlike the numbers they show. Members have no in-app route to the tour except the standard sidebar, which is a deliberate limit rather than an oversight. In return the home route remains the product, a shared link lands on a working composer, and the explanation lives where a search engine can read it.
