# Retain device-run conversations by account choice

- **Change:** Conversation retention is independent from the model's compute site. Pro users can keep a conversation answered by a device model, and temporary chats remain device-private.
- **Surfaces:** Web Chat and the desktop conversation shell.
- **Prerequisites:** A signed-in Pro account, an available device model, and the normal API/session configuration.
- **Risk if wrong:** A retained device response could remain stranded on one machine, or a temporary transcript could reach server storage.
- **Commits:** Not available.

## Verify

- [ ] Start a Pro conversation with a device model without selecting temporary retention; after the response, reopen it from another client or session and confirm the transcript is present.
- [ ] Create a temporary conversation, confirm the sidebar marks it as temporary, use “Keep this chat — uploads the transcript to your account”, and confirm it becomes available through the remote conversation list.
- [ ] Confirm a signed-out or Free conversation still shows the reason-specific device-retention notice and creates no remote conversation.

**Stop and report if:** a kept device response cannot be reopened elsewhere, a temporary transcript appears in the API or remote list, or the promotion control changes state without a successful API write.
