---
"@assistant/api": patch
"@ngriffin_uk/polychat-component-shell": patch
"@ngriffin_uk/polychat-component-ui": patch
"@ngriffin_uk/polychat-utility-core": patch
---

Paginate flagged dataset rows correctly and preserve remaining warnings when excluding rows. Recalculate revision statistics, reject invalid indexes, reuse repeated exclusions, and recover partial saves without duplicating files.

Preserve selections after failed actions, open the resulting revision after success, and show dataset loading errors. Fail missing upload previews promptly and cancel source streams when previews stop early.

Associate switch labels and descriptions automatically when no explicit control ID is supplied.
