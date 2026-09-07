# ADR 0079: Share one connected navigation shell between web and desktop

Status: Implemented in `packages/component-shell`, `apps/app` and `apps/desktop`; the desktop application is not yet released.

## Problem

[ADR 0076](0076-desktop-core-owns-egress.md) holds that the desktop application ships no interface of its own, and that a component written for the desktop alone is a defect. Until now it rendered a single conversation with no way to reach anything else, so the rule cost nothing.

Giving it navigation breaks that quiet. The sidebar, the header, the conversation list and its menus, global search and the settings popover are the largest connected surfaces in the web application, and they read the router, the stores and the API client. Our `component-*` packages deliberately do not, so the parts already shared are only the controlled halves; every wiring layer lives in `apps/app`. Copying that wiring into the desktop would duplicate roughly a thousand lines that change whenever chat navigation changes, and the two would drift apart within a release.

The desktop also cannot answer for every destination the shared sidebar offers. Work, Files, Teammates, Discover and the profile have no desktop implementation, and some actions behind those links — Ask Poly above all — have no shared implementation to call.

## Decision

Extract the wiring itself into `packages/component-shell` and let both hosts mount it.

The package is the single exception to the router-, store- and client-free rule for `component-*`, and it earns that by being the layer whose whole job is connection: it holds the chat sidebar, the product and conversation headers, the page and product shells, global search, the conversation menus and the not-found page. The controlled presentation stays where it was in `component-navigation` and `component-ui`; nothing moves down into those packages.

What genuinely differs between hosts arrives through `ShellHostProvider`: the origin public share links point at, the dialogs a host owns alone, and the actions that open them. A host that has not migrated an action supplies one that throws. A shared control that quietly does nothing is worse than an error, because the gap stops being visible the moment it ships.

Destinations the desktop has not migrated resolve to the shared not-found page rather than being hidden. `apps/desktop/src/route-definitions.ts` is the whole map: personal chat, the chat sub-routes it does not serve yet, and everything else. Naming the unmigrated chat routes explicitly matters, because otherwise `/chat/attention` reads as a conversation id.

## Consequences

Chat navigation now has one implementation. A change to the conversation list, the sidebar or the header reaches both hosts, and a desktop-only navigation component remains a defect.

The exception is load-bearing and easy to widen by accident. `component-shell` may connect the shell; a feature surface that finds itself importing stores belongs in a host or behind a controlled component, not here. The package depends on `library-react` and `library-client`, so those cannot depend on it.

Route coverage is asserted rather than assumed: the desktop route map is data, and its test states which paths reach a conversation and which answer 404. Migrating a destination means changing one entry and one expectation.

The desktop's link set is deliberately larger than what it serves. Someone using it will meet 404 pages, and the Ask Poly button will report that it has not been migrated. Both are the honest position while the shell is unreleased, and both become work items rather than silent gaps.
