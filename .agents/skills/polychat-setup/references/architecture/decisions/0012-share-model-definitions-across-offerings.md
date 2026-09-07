# ADR 0012: Share model definitions across provider offerings

Status: Implemented.

## Problem

Full configurations repeated model facts across provider files, while the models.dev sync omitted available descriptions. Manual restructuring would be expensive to repeat and could silently lose execution exceptions.

## Decision

Store each family in one JSON file containing its description, defaults and shared model definitions. Store each provider's defaults and offerings in its own JSON file. Resolve family, model, provider and offering layers in order; replace nested values completely and use explicit field removal to preserve absent values.

Let models.dev tooling own both the complete source conversion and subsequent catalogue generation. Compare every converted offering with the original configuration, preserving public IDs and all operational values. Keep the application on a single catalogue resolver.

## Consequences

Shared descriptions and expectations have one editable home, while provider exceptions remain visible. A generated import index carries no independent configuration, and saved upstream snapshots make replay deterministic without paid inference.

Grouping by family and normalised display name is deliberately conservative, so differently named variants can remain separate. Provider ordering remains significant for existing public IDs. Model lifecycle beyond active or absent is not modelled: see [0011](0011-resolve-models-and-readiness-on-the-server.md) for the active-only policy this representation serves. Editing procedure lives in [catalogue operations](../../operations/model-catalogue.md).
