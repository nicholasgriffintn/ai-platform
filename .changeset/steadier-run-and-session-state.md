---
"@assistant/api": patch
"@assistant/desktop": patch
"@assistant/mobile": patch
"@assistant/sandbox-worker": patch
"@ngriffin_uk/polychat-cli": patch
"@ngriffin_uk/polychat-component-conversation": patch
"@ngriffin_uk/polychat-component-shell": patch
"@ngriffin_uk/polychat-component-sites": patch
"@ngriffin_uk/polychat-library-client": patch
"@ngriffin_uk/polychat-library-react": patch
"@ngriffin_uk/polychat-library-sites": patch
"@ngriffin_uk/polychat-schemas": patch
"@ngriffin_uk/polychat-utility-core": patch
---

Cancelling a queued sandbox run now stops it, and a run that loses its worker connection, stops responding or is interrupted now fails and returns its held credits instead of staying in progress. Cancelled and finished tasks stay that way when a run finishes at the same moment, and two conflicting status changes now ask you to refresh. Two admins deciding the same hire can no longer both win, and a manual pause on a teammate is no longer replaced by a budget pause. On iOS, Apple Health sharing now belongs to the account that turned it on and ends at sign-out, so turn it on again after updating or signing back in, and opening the app offline keeps you signed in. Notes save your last edits when you leave mid-save, the microphone turns off when you leave the chat, spoken replies no longer get stuck on generating, and a failed dictation session no longer looks live. Generated images and Google Fonts now show in site previews, and the preview no longer comes up blank where a browser blocks its sandboxed frame from loading files. Sites hold refinements and manual edits until image generation finishes. On desktop, reopening a terminal straight after closing it keeps the new one working, and stopping an agent no longer hangs behind a stuck message. Logging in to several servers at once from the CLI keeps all of them.
