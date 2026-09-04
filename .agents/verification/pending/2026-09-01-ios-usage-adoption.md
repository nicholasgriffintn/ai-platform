# iOS has no usage surface yet — decision recorded

- **Change:** none shipped. The credit billing surfaces landed on web only; iOS currently shows no usage or billing information at all.
- **Surfaces:** iOS (decision only)
- **Prerequisites:** none.
- **Risk if wrong:** an iOS usage feature built later against counters that no longer exist instead of the credit balance.

## Verify

> Local evidence (4 September 2026): `pnpm test:mobile` passed, including usage-limit stream decoding. The product-decision check below remains open.

- [ ] When iOS adopts usage display, it reads `GET /user/usage/balance` for the headline included/used/reserve/state figures, and treats the `reserve` state as a heads-up, not an alarm.

## Notes

The `usage_limits` chat-stream metadata now carries only a `credits` object, so the iOS client can read live state mid-conversation without polling. `ChatUsageLimits.Allowance` and its `daily` field were removed with the message counters.
