---
"@assistant/api": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-component-account": minor
"@ngriffin_uk/polychat-component-shell": minor
---

Memories are now always kept as documents you can read and edit, and Poly finds them the way it finds your files.

- **One kind of memory.** Polychat's own memory keeps what it learns about you, and about each project, as documents under Files › Memory. The old one-line memories are gone, so Poly starts these documents fresh.
- **Better recall.** Memories are searched by meaning and by exact words, and Poly gets back the passage that matters rather than a whole document.
- **Quick notes, tidied later.** When a memory document is long or has just changed, new memories are added under Recently noted straight away and folded into the document a few minutes later.
- **Your search index, your storage.** If you keep your search index in S3 Vectors or DynamoDB Vectors, it now holds your own files as well as your memories. Choose it under Settings › Knowledge.
