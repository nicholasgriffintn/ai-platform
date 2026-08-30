# ADR 0026: Locked conversations are encrypted on the device

## Status

Accepted

## Context

Every useful thing Polychat does with a conversation depends on the server being able to read it. Titles, search, memory, retrieval, tools, compaction, sharing, training capture, and activity records are all derived from `message.content`. That is the right default, and it is also why there was no answer for a conversation someone does not want us to hold at all. The nearest thing we had was local-only mode, which stops a conversation syncing but leaves it in plaintext in IndexedDB, on one device, with no protection at rest.

Encrypting on the device settles the storage question and immediately raises three harder ones. The model still needs plaintext, because a model cannot answer ciphertext. The gateway in front of every provider logs request bodies by default and receives the user's email and id as metadata, so "Polychat cannot read this" would be false while a locked prompt still reached that log. And ADR 0024 deliberately made turns outlive the client so their answer is saved — a turn whose answer nobody can save spends provider money for nothing when the tab closes.

Passwords brought their own problem. There is no server in the unlock path, so nothing can rate-limit a guess, and anyone holding the wrapped key can attack it offline for as long as they like. WebCrypto offers PBKDF2 and nothing better without a WASM dependency.

## Decision

A locked conversation is the ordinary conversation with client-held keys and every plaintext-deriving capability removed. The `conversation` row survives intact, so ownership, archiving, deletion, and the sidebar need no special cases; its `title` goes null and `locked_at` is set. Sealed envelopes live in `locked_message` and wrapped keys in `conversation_lock_key`, so `message` never holds ciphertext and no existing server path has to learn to skip it.

Two key layers. A random 256-bit conversation key encrypts messages; that key is wrapped separately by each way in. Changing the password re-wraps one key rather than re-encrypting a thread, and a recovery key can exist at all. Passkeys are the default entry method through the WebAuthn PRF extension, which turns an authenticator into a stable secret per salt; a password is the alternative for authenticators without PRF, derived with PBKDF2-SHA256 at 600,000 iterations. Every lock also carries a recovery key, because neither a lost passkey nor a forgotten password can be reset. `kdf` and `kdf_params` are stored from the start, so moving to Argon2id later re-wraps one key per conversation rather than migrating every message.

Envelopes are AES-GCM with additional authenticated data binding the conversation id, message id, and sequence. A blob moved between conversations or replayed at another position fails its tag rather than decrypting into the wrong thread. There is no separate password verifier: the wrapped key is its own proof, and one fewer crackable artefact sits at rest.

The turn refuses, at the API, everything that would write plaintext — tools, retrieval, memory, attachments, multi-model, background, server compaction, agents, connectors, and the sandbox. `findLockedTurnViolations` in `packages/schemas` is the single definition, shared by the composer so the interface never offers what the server will reject. Locked turns send `cf-aig-collect-log: false`, no gateway metadata, and a zero cache TTL, through one `buildAiGatewayControlHeaders` helper that every chat provider now uses. Locking an existing conversation destroys the plaintext the server holds — messages, attachments in R2, sources, outputs, goals, activity records, and training examples — in that order, after the envelopes are stored.

Locked turns opt out of ADR 0024's durability. `createChatTurnStream` skips `waitUntil` when the turn is locked, so a closed tab ends the turn instead of paying for an answer that has nowhere to go.

Locking is Pro, because it depends on server-side conversation sync. It extends local-only mode rather than replacing it: `resolveConversationStorageMode` gains an `isLocked` input, and a locked conversation reports `shouldPersistPlaintext: false` so plaintext stays in memory and never reaches IndexedDB either.

## Trade-offs

The model provider sees plaintext. This is unavoidable and the interface says so in the same panel that claims we cannot read it; a version of this feature that hid that would be dishonest rather than private.

Offline cracking is bounded only by the KDF. PBKDF2 at 600,000 iterations is the OWASP floor and materially weaker against GPUs than Argon2id, which we did not take because it means a WASM dependency in the web bundle and an equivalent on iOS. Passkeys sidestep the problem entirely, which is why they are the default rather than an option.

Losing every key loses the conversation, permanently, and locking an existing one is irreversible in the sense that its attachments and derived data do not come back. Unlocking restores the thread, not the files.

The thread is resealed in full on every write. Envelopes are small and the context cap keeps threads short, so this is cheaper than the sequence bookkeeping that incremental appends would need across retries, edits, and branches. It is the first thing to revisit if locked threads grow.

There is no server-side compaction, so the composer stops at a client-side token cap and says why. That is a hard stop rather than a degradation, and it is what the user asked for over silently dropping the oldest turns.

iOS lists locked conversations and explains that they open on the web. Shipping the crypto twice for the first version was not worth it, but the surface had to change regardless — without it, iOS would render an empty thread with no explanation.

A tab holds the key only in memory, so a reload re-prompts. Signing out clears every unlocked conversation.
