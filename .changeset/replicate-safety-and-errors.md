---
"@assistant/api": patch
"@ngriffin_uk/polychat-ai-providers": patch
"@ngriffin_uk/polychat-component-content": patch
"@ngriffin_uk/polychat-component-conversation": patch
"@ngriffin_uk/polychat-component-experiences": patch
"@ngriffin_uk/polychat-library-chat": patch
"@ngriffin_uk/polychat-library-client": patch
"@ngriffin_uk/polychat-library-model-catalogue": patch
"@ngriffin_uk/polychat-library-prompts-catalogue": patch
"@ngriffin_uk/polychat-library-react": patch
"@ngriffin_uk/polychat-schemas": patch
"@ngriffin_uk/polychat-utility-core": patch
"@ngriffin_uk/polychat-utility-server": patch
---

Nano Banana Pro, SDXL Lightning, MusicGen and Hunyuan Video work again from the Replicate page, and finished predictions show their image, audio player or video. Safety settings we control no longer appear as options you can change.

Errors are clearer: when a provider rejects a request you see the reason, and a failed run shows its banner straight away.

Second opinion now picks reviewers from your own model tiers, always on different providers from each other, checks the answer you asked about, and tests it against what your tools actually returned. Tool results, arguments and approval details read as plain labelled text instead of raw JSON, and leaked model control text no longer reaches your replies. Inline images in chat now display, and they stay out of conversation titles.

Your connected MCP integrations now show as ready when the assistant looks for them, and you can keep chatting after a reply that is waiting on setup.
