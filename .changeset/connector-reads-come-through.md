---
"@assistant/api": patch
"@ngriffin_uk/polychat-ai-integrations": patch
"@ngriffin_uk/polychat-ai-providers": patch
"@ngriffin_uk/polychat-utility-core": patch
---

Connected services read properly again. Trakt history loads instead of being blocked, remote MCP servers such as Marquee connect from Polychat's servers, and Discover keeps using the location on your profile when the saved setting is blank, so weather and local headlines return. Discover also reads this week's top Reddit posts on the topics you follow and the day's top DEV articles. A service that answers in a shape Discover cannot read now shows an error rather than "Nothing new". Discover no longer reads NASA's picture of the day, because NASA's service currently returns a placeholder instead of the picture.
