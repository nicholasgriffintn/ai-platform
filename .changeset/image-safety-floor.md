---
"@assistant/api": patch
"@ngriffin_uk/polychat-ai-providers": patch
---

Image and video generation now runs one safety check across every provider. Polychat refuses sexualised depictions of minors and intimate images of real people without their consent, in chat, Studio, drawings and generation tools. Provider safety filters also stay on, so they can no longer be turned down in model options. If a request can't be checked, for example because a reference image is over 4 MiB, nothing is generated and you'll see a message saying why.
