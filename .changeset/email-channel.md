---
"@assistant/api": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-utility-server": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-library-prompts-catalogue": minor
---

Let people reach Polychat by email. A personal email binding is keyed by the address you write from, linked with the usual one-time command, and answered by threaded plain-text replies. Inbound mail arrives through the Worker email handler and is only accepted when a DKIM signature aligned with its From domain also covers the To or Cc header naming Polychat's inbox, so forged senders and replayed messages are refused. Auto-replies are ignored to avoid loops.
