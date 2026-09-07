---
"@assistant/desktop": patch
---

Let the desktop window discover its pages instead of listing them twice.

The window kept a route table and a page table side by side, and every place the desktop had not built yet was repeated in a third list so `/chat/:completionId` did not read `/chat/attention` as a conversation. Adding one place meant editing all three.

A page is now a directory under `src/pages`: `routes.ts` declares the paths it answers and `page.tsx` default-exports what to render. The route table is built from those declarations, and a place still on the unbuilt list stops answering 404 as soon as a page claims its path — so bringing a place across touches only its own directory.
