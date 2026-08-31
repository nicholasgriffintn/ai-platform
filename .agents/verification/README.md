# Verification queue

`pending/` holds one item per unverified change: what changed, what an operator must do first, and the steps to confirm it works against the deployed product. `archive/` holds the items already checked, grouped by the deploy they were checked against.

Agents write items here as they work. Only a human ticks the boxes.

The process, item format, and the way to rebuild this queue from the last deployment live in [verification.md](../skills/polychat-setup/references/verification.md).
