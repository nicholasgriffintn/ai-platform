# Conversation view reduction pass

- **Change:** Muted text is lighter in the four dark palettes; markdown responses use theme colours at weight 400 and line height 1.6 instead of the typography plugin's zinc ramp; the conversation column and composer widen from 48rem to 52rem; user messages sit on the neutral selection surface rather than an action-colour tint; empty-state titles use the display face; sidebar section headings are one consistent style and the conversation list is separated from the navigation above it by a rule.
- **Surfaces:** Every conversation view in Chat and Work, empty states across the web app, chat and standard sidebars.
- **Prerequisites:** None.
- **Risk if wrong:** Muted text could lose its secondary feel, prose colours could mismatch in a theme, a wider column could make short replies feel sparse on laptops, or the user bubble could blend into hover states.
- **Commits:** None yet.

## Verify

- [ ] Open a long assistant reply in Dark and in Fern. Confirm body text reads at regular weight with visibly more line spacing than before, links use the theme accent, and code and table borders follow the theme rather than grey.
- [ ] Send a message and confirm the user bubble uses the same tinted surface as a selected sidebar item, with a plain border, in Dark, Fern and Paper.
- [ ] Compare metadata, model controls and sidebar headings in Dark and Fern against a disabled control: muted text should now read as secondary rather than disabled.
- [ ] On a 1280px window, confirm the reply column and composer are slightly wider than before and still align with each other.
- [ ] Open the chat sidebar with conversations present. Confirm Discover and Recent conversations headings share one style, and that a rule separates the navigation block from the list.
- [ ] Open an empty state such as Work signed out or an empty project list and confirm the title renders in the display face at a size that fits its card.

**Stop and report if:** Any prose colour is unreadable in a theme, muted text is indistinguishable from primary text, or the user bubble cannot be told from a hovered row.
