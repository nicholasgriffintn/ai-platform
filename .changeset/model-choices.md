---
"@assistant/api": minor
"@assistant/app": minor
---

Choose the models Polychat uses behind the scenes. Profile → Model choices lists every background job, from titling and compaction to dictation, document reading, pictures and voice, and lets you pick a first choice plus fallbacks from the models your account can run. Fallbacks also step in when a model fails mid-job. Workspace owners and admins can set the same choices for a whole workspace under Models → Model choices, and those apply to its projects ahead of each member's own.

Anything you leave alone runs on the platform defaults, which are now Workers AI models throughout. Discover, notebook studio drafts, podcast scripts and framing use the new Writing job instead of a chat tier. Sketches are now repainted with FLUX.2 [klein], and Gemma 4 can read images for Documents. When a model you picked is retired or no longer available to you, Waiting on you flags it and the job runs on your next choice until you replace it. Your previous transcription setting carries over as your Dictation choice.

"Fill these in for me" ranks the models you can run for each job by the benchmark that suits it, optionally keeping to one provider you've connected, and shows the picks before you apply them. Documents now offers Mistral OCR, and GreenPT adds Metis for decisions and guardrails alongside DeepSeek V4.1 Flash 1017 and MiniMax M3. The Models page shows what actually runs for you for each background job.

Model choices is now the one place for every model setting. Your default tier, default model and sandbox coding model moved there from Customise Chat, and are picked from the models you can run rather than typed in. The speech provider and model now come from the Voice job, and Customise Chat keeps the voice and expressiveness for whichever voice model is active. A speech model you had chosen carries over as your Voice choice. The Guardrails job now offers Llama Guard, TypeSafe's Jev and Mistral moderation, and the model you pick decides which checks run. Bedrock and Shieldstral stay as separate guardrail services in Customise Chat, and a previous TypeSafe or Mistral setting carries over as your Guardrails choice.
