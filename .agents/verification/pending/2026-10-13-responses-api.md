# Verify the Responses API transition

- **Change:** Chat, Work, teammates and Poly run through `POST /responses`, read conversations through `/conversations`, and stream one sequenced event envelope. `/chat/completions` is a compatible port that also serves the hosted agent harnesses.
- **Surfaces:** web, desktop, API, agent worker. iOS still calls the previous routes and is not covered.
- **Prerequisites:** a signed-in Pro account with a project, a teammate, and one hosted harness model available.
- **Risk if wrong:** a turn streams but never settles, an approval or question cannot be answered, a replayed response disagrees with the stream, or a harness cannot reach its model.

## Verify

- [ ] Send a Chat turn and watch the network: one `POST /responses` with `conversation.id`, items in `input`, and a stream of `response.*` events ending in `response.completed` then `[DONE]`. Refresh and confirm `GET /conversations/:id` returns the same items.
- [ ] Trigger a tool approval, approve it, and confirm the continuation is a `POST /responses` carrying an `approval_response` or `interaction_response` item and `response_id`.
- [ ] Open the same conversation on a second device while a turn runs. Confirm the follower's `latest_response` advances through `GET /responses/:id/events` and settles without a reload.
- [ ] Run a teammate turn and a Poly turn. Confirm each is a `POST /responses` with `agent.type = teammate` and no teammate completion route is called.
- [ ] Start a response, cancel it from the composer, and confirm `POST /responses/:id/cancel` returns the Response with `status` cancelling or cancelled.
- [ ] Run a Pi or OpenCode harness turn and confirm the agent worker reaches `POST /chat/completions` with the delegation token and streams `chat.completion.chunk` events.
- [ ] Point an unmodified OpenAI SDK at `/chat/completions` with an API key and confirm a plain completion and a streamed completion both work.
- [ ] Compact a long conversation and confirm `POST /responses/compact` returns items including the compaction marker.

**Stop and report if:** a stream has gaps or repeats in `sequence_number`, an approval cannot be answered, a response stays `in_progress` after the stream closed, or a harness turn fails to reach a model.
