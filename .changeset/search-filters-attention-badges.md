---
"@ngriffin_uk/polychat-component-navigation": minor
"@ngriffin_uk/polychat-component-workspaces": minor
"@ngriffin_uk/polychat-component-shell": patch
---

Filter global search by kind, and show unread Attention counts in both sidebars.

- The search dialog shows filter chips (All, Chats, Projects, Workspaces, Capabilities), each with a count. Only kinds present in the results are offered, and arrow keys and Enter work on the filtered list.
- `SidebarNavLink` accepts `count` and `countLabel`, and `component-navigation` exports `SidebarCountBadge`. The badge caps at 99+ and gives screen readers a text label (an `aria-label` on a plain `<span>` isn't reliably announced).
- The Chat sidebar's Attention link and the Work sidebar's Attention link (`WorkSidebarNav` `attentionCount`) show the unread notification count. The per-project Tasks badge uses the same component.
