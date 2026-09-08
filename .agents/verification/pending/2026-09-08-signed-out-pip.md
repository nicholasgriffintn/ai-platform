# Signed-out Chat always shows Pip

- **Change:** Unauthenticated Chat ignores the temporary-conversation Wisp rule and all account/model pet settings, so its pet is always Pip; signed-in pet selection remains configurable.
- **Surfaces:** Chat welcome screen and composer pet.
- **Prerequisites:** A signed-out browser session and a signed-in account with a temporary chat and a non-Pip pet selection.
- **Risk if wrong:** Signed-out visitors may see Wisp or a private account pet, while signed-in temporary-chat behaviour could regress.
- **Commits:** Pending.

## Verify

- [ ] Sign out, open a new Chat conversation, and confirm the welcome pet is Pip; reload and confirm it remains Pip.
- [ ] While signed out, enter a temporary conversation and confirm the composer pet also remains Pip.
- [ ] Sign in, open a temporary conversation, and confirm Wisp still appears; select another preset or custom pet and confirm the signed-in selection remains respected.
- [ ] Sign out from that account and confirm the signed-out view returns to Pip without exposing the account's selected pet.

**Stop and report if:** a signed-out surface shows Wisp or a private pet, or signed-in temporary conversations lose their existing pet behaviour.
