# Recover chat activity after refresh and constrain automatic routing

- **Change:** Restore pending response activity and polling after refresh. Limit auto routing to text-response chat models and retain requirement-based routing when AI analysis fails.
- **Surfaces:** Web Chat and Work, API and the shared model picker policy. iOS can ignore the optional active operation field.
- **Prerequisites:** Deploy the API and web together with the existing conversation coordinator binding. No migrations.
- **Risk if wrong:** Responses appear idle while running, fail to load automatically, or choose specialist media models.
- **Commits:** Uncommitted changes on main.

## Verify

- [ ] Send a message, refresh immediately, and confirm activity and Stop return while the model works.
- [ ] Leave and reopen the chat; confirm the final response appears without another refresh.
- [ ] Stop a response after refresh and confirm activity clears when the server releases the turn.
- [ ] Repeat in a Work project and confirm unauthorised accounts cannot read the operation status.
- [ ] Use Auto for a short greeting and a complex prompt; confirm the eligible pool excludes audio generation, image generation, realtime, transcription and OCR models.

**Stop and report if:** activity persists after the turn ends or expires, a specialist model is selected automatically, or private conversation status becomes accessible.
