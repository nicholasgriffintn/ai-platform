# ADR 0069: Share model definitions across provider offerings

Status: Implemented.

## Problem

Full configurations repeated model facts across provider files, while the models.dev sync omitted available descriptions. Manual restructuring would be expensive to repeat and could silently lose execution exceptions.

## Decision

Store each family in one JSON file containing its description, defaults and shared model definitions. Store each provider's defaults and offerings in its own JSON file. Resolve family, model, provider and offering layers in order; replace nested values completely and use explicit field removal to preserve absent values.

Let models.dev tooling own both the complete source conversion and subsequent catalogue generation. Compare every converted offering with the original configuration, preserving public IDs and all operational values. Keep the application on a single catalogue resolver and remove the old provider files and constructors.

## Consequences

Shared descriptions and expectations have one editable home, while provider exceptions remain visible. A generated import index carries no independent configuration. Saved upstream snapshots make replay deterministic without paid inference or live analysis.

Grouping by family and normalised display name is deliberately conservative; differently named variants can remain separate. Majority defaults reduce repeated values, with explicit overrides and removals retaining differences. Provider ordering remains significant for existing public IDs, and this representation does not implement the future lifecycle or governance designs in ADRs 0038 and 0040.
