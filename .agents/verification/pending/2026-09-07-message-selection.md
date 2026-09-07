# Message selection quoting

- **Change:** Assistant response text can be selected and quoted into the composer as a durable `selection` attachment. Artifact selections use the same contract.
- **Surfaces:** Shared conversation UI, schemas, API formatter and composer.
- **Static evidence:** Schema, formatter and composer tests; API, app and component typechecks.
- **Human check:** Select text spanning one or more rendered paragraphs in an assistant response. Confirm the contextual Quote action appears, adds a `Quoted response` chip to the composer, and the composer remains usable. Send it with a short instruction and confirm the provider receives the saved excerpt marked inside `<selection>` with its message source.
- **Risk if wrong:** The action appears for non-assistant text, loses whitespace while quoting, or sends a source pointer without the saved excerpt.
