# Task inbox and notification delivery

- **Change:** Web and iPhone now share a current-state task inbox, per-category preferences, installation-owned push registration, safe deep links and revalidated delivery.
- **Surfaces:** API, web Work, web service worker, native iPhone.
- **Prerequisites:** Apply migration `0026_melodic_black_panther.sql`. Configure `PRIVATE_KEY`, the HTTPS notification gateway and its token, the Web Push public key and matching VAPID private material. Configure APNs signing credentials, the Push Notifications capability and a provisioning profile for the iOS bundle. Use a secure web origin and at least one real iPhone; the simulator does not prove APNs delivery.
- **Risk if wrong:** Notifications may be duplicated, missed, delivered after access changes, disclose task detail, survive sign-out, or imply an action that is no longer current.
- **Commits:** Uncommitted goal work.

## Verify

- [ ] Open Work on web and iPhone with tasks awaiting a decision, blocked after a meaningful failure, assigned to you and recently completed by or for you. Confirm the same eligible items appear, other members' assignments do not, and completions disappear after 30 days.
- [ ] Mark an item read and dismiss another. Confirm the changes follow the account across clients and no task status, assignment, decision or execution state changes.
- [ ] On web, enable notifications from the settings control. Confirm the browser prompt, operating-system permission and backend registration are shown as separate states. Deny permission, retry, then grant it and confirm registration succeeds only after a subscription is saved.
- [ ] On a real iPhone, grant notification permission and confirm an APNs token registers this installation. Trigger each enabled category, receive the generic notification, tap it and confirm Polychat opens current task detail with the existing decision controls and activity timeline.
- [ ] Replace the browser subscription or APNs token for the same installation. Confirm later delivery uses the replacement once, and the old endpoint is not retained or delivered to another account.
- [ ] Resolve or transition a task on the other client before tapping an old notification. Confirm the link reports changed state or opens only current detail and cannot restore the old action.
- [ ] Disable one category, then disable all notifications. Confirm inbox visibility remains independent, no disabled deliveries are sent, and the client reports backend registration as disabled rather than confusing it with operating-system permission.
- [ ] Sign out on one device while another remains signed in. Confirm only the signed-out installation is removed and the other device continues receiving eligible notifications. Sign back in and confirm registration recovery succeeds.
- [ ] Revoke workspace membership after a delivery is queued and before it is sent, then repeat before opening a delivered notification. Confirm delivery is made obsolete and the link reveals no task detail.
- [ ] Return 410 from the provider gateway for a registration. Confirm it becomes failed with an endpoint-expired state, then replace the token and confirm delivery recovers. Make the gateway temporarily unavailable and confirm pending delivery retries without duplicating a successful task/version delivery.
- [ ] Inspect the gateway request and stored database values. Confirm copy is generic, payload data contains only current identifiers and the deep link, raw task detail and tool data are absent, and the destination is encrypted at rest with only its fingerprint indexed. Replay the same `Idempotency-Key` and confirm the gateway invokes Web Push or APNs only once.

**Stop and report if:** an inbox receipt mutates task state, a stale or unauthorised link exposes task data, a sign-out removes another installation, or a delivery contains task content beyond generic category copy and identifiers.
