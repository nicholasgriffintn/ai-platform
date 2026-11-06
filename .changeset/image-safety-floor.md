---
"@assistant/api": patch
"@ngriffin_uk/polychat-ai-providers": patch
"@ngriffin_uk/polychat-utility-server": patch
---

Image and video generation now runs one safety check across every provider. Polychat refuses sexualised depictions of minors and intimate images of real people without their consent, in chat, Studio, drawings and generation tools. The check covers your prompt, recent conversation turns and any reference images or videos, and every generated image is checked before it is saved or shown. Provider safety filters also stay on, so they can no longer be turned down in model options. If something can't be checked, nothing is generated or kept and you'll see a message saying why. Reference videos need to be MP4 or WebM files under 16 MiB.
