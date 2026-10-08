---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-skills-catalogue": minor
"@ngriffin_uk/polychat-utility-react": minor
"@ngriffin_uk/polychat-component-content": minor
"@ngriffin_uk/polychat-component-conversation": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-library-react": patch
"@assistant/api": minor
"@assistant/app": patch
---

Let React artifacts show live data and charts. An artifact can declare read-only connector reads in a leading `<bindings>` block and read them with `usePolychatData` from `@polychat/data`. The host runs each read through the API, which takes the declaration from the stored message, refuses operations that change anything, only lets a refetch change declared arguments, caches results for a minute and rate-limits each artifact. React artifacts now compile with Sucrase instead of Babel standalone, can import `recharts`, and are assembled without string replacement, so `$` sequences and `</script>` in component source no longer corrupt the page.
