---
"@ngriffin_uk/polychat-utility-server": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@assistant/api": minor
---

When a provider says your credits have run out, Polychat stops sending it work and moves on to the next model you have access to. Chats and scheduled routines that use an automatic model tier carry on with the next model in that tier mid-run. Speech renders switch to your next-best voice and finish, rather than failing until the month resets.

- A model you picked yourself is never swapped. If its provider is out of credit, the error is shown.
- Episodes, podcasts, video overviews and wind downs restart on the new voice, so one recording never mixes two voices.
- ElevenLabs, OpenRouter and DeepSeek balances are checked in the background. The provider comes back as soon as your credits reset or you top up.
- Keys that can't read their own balance, such as an ElevenLabs key limited to text to speech, get another try 15 minutes later. A refused request costs no credits, and if it is still empty your audio carries on with the next voice.
- Saving a new key for a provider clears its out-of-credits state straight away.
