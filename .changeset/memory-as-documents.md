---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-prompts-catalogue": minor
"@ngriffin_uk/polychat-utility-server": patch
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
---

Memories are kept as whole documents, and what Polychat gathers is summarised rather than pasted.

- **One document per subject.** When Polychat remembers something with document memory, it files it into the memory document for that subject, or starts a new one, instead of adding a line to a single list. The whole document is rewritten each time: what to remember, why, and how it should shape future answers, with links to related memories. A newer fact replaces the one it contradicts.
- **Memories say what they hold.** Each memory document has a one-line description and a kind: about you, how to work with you, ongoing work, or where to find things. Poly picks memories by those descriptions, and you can see them under File info.
- **Summaries for gathered reading.** Pages Discover reads and the browsing your Mac shares are recorded with a summary of what each page says and its key points, rather than its opening lines. Discover keeps the whole page in its notebook. Documents also get a summary when they are added or change, so when a notebook is too big to read in full, guides, Studio and episodes get a summary of every source instead of only the first few.
- **Service documents are easier to read.** Each service's document in the Discover notebook lists what was found without the raw response underneath.
