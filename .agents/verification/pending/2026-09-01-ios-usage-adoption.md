# iOS has no usage surface yet — decision recorded

- **Change:** none shipped. The credit billing surfaces landed on web only; iOS currently shows no usage or billing information at all.
- **Surfaces:** iOS (decision only)
- **Prerequisites:** none.
- **Risk if wrong:** an iOS usage feature built later against the legacy daily counters instead of the credit balance.

## Verify

- [ ] When iOS adopts usage display, it reads `GET /user/usage/balance` for the headline included/used/reserve/state figures rather than the legacy daily message counters, and treats the `reserve` state as a heads-up, not an alarm.

## Notes

The `usage_limits` chat-stream metadata now carries an optional `credits` object alongside `daily`/`pro`/`byok`, so the iOS client can also read live state mid-conversation without polling.
