# Signed-out Chat always shows Pip

- **Change:** Unauthenticated Chat ignores the temporary-conversation Wisp rule and all account/model pet settings, so its pet is always Pip; signed-in pet selection remains configurable.
- **Surfaces:** Chat welcome screen and composer pet.
- **Prerequisites:** A signed-out browser session and a signed-in account with a temporary chat and a non-Pip pet selection.
- **Risk if wrong:** Signed-out visitors may see Wisp or a private account pet, while signed-in temporary-chat behaviour could regress.
- **Commits:** Pending.

## Verify

- [x] Sign out, open a new Chat conversation, and confirm the welcome pet is Pip; reload and confirm it remains Pip.
- [x] While signed out, enter a temporary conversation and confirm the composer pet also remains Pip.
- [x] Sign in, open a temporary conversation, and confirm Wisp still appears; select another preset or custom pet and confirm the signed-in selection remains respected.
- [x] Sign out from that account and confirm the signed-out view returns to Pip without exposing the account's selected pet.

**Stop and report if:** a signed-out surface shows Wisp or a private pet, or signed-in temporary conversations lose their existing pet behaviour.

## Further automatic validation — 8 September 2026

- The current 227-test library-react suite passes useActivePet signed-out temporary coverage with account settings present; the hook resolves Pip and the composer consumes that hook. This is hook/source evidence, not a new sprite-animation assessment.

## Auth-transition evidence — 9 September 2026

- Three focused hook tests pass: signed-out temporary mode ignores retained private account settings; signed-in temporary mode still selects Wisp; an authenticated Ash selection becomes Pip on sign-out and stays Pip after remounting with those account settings retained. The normal welcome and composer Pet instances both consume this hook without an override. This validates selection and remount boundaries; no sprite-animation or physical-device claim is made. Reused the shared query-client test wrapper.
