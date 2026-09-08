# A delegate can message its parent, and the grant can be taken back

- **Change:** a delegation is granted a handle on its parent conversation, the `message_parent` tool delivers through it, a busy parent queues the message, and the grant can expire or be revoked.
- **Surfaces:** API delegation and handle endpoints, Chat thread, Work workbench.
- **Prerequisites:** migration `0047_shocking_snowbird` adds the `conversation_handle` table.
- **Risk if wrong:** a delegate writes into a conversation whose grant was withdrawn, or into a conversation that is not its parent.
- **Commits:** 9c60db172, 5dfc6cf0c, b5c468bf1, 823433b25, 33809a58f.

## Verify

- [ ] Start a delegation, have it message the parent, and read the message in the parent thread.
- [ ] Send while the parent is mid-turn and confirm the message arrives once the turn finishes rather than being lost.
- [ ] Revoke the handle, have the delegate message again, and confirm the delivery is refused.
- [ ] Let a handle expire and confirm the same refusal.
- [ ] Remove the delegating user's access to the parent's project and confirm delivery stops.
- [ ] Confirm the parent conversation shows unread after a delivered message.

**Stop and report if:** a message lands after revocation or expiry, or a delegate reaches a conversation other than its own parent.
