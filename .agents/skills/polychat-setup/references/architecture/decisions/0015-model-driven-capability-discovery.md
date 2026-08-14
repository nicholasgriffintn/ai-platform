# ADR 0015: Model-driven capability discovery

## Status

Accepted

## Context

The assistant action catalogue and capability descriptor describe apps, recipes, connectors, agents, and tools, but model-callable discovery previously searched only registered function tools. Recipes and connectors also disappeared from model context until a person installed or connected them, so the assistant could not explain that a suitable capability existed or offer setup at the point of need.

Giving the model executable connector schemas or accepting setup URLs from a tool result would widen authority. Work discovery must also keep the project boundary: a project conversation cannot expose unrelated personal recipes or tools merely because the current member can see them elsewhere.

## Decision

Provide one read-only `discover_capabilities` function and enable it by default for tool-capable chat models. It searches tools, recipes, and connectors using bounded model-supplied filters and returns each match with an explicit configured flag, readiness state, reason, and an optional stable setup reference.

This is the only global capability catalogue search. Do not retain parallel function-search or schema-lookup tools that can return a competing answer. Each discovery item names one canonical invocation tool and states whether it is callable in the current conversation. Recipes name `trigger_recipe`, connectors name `use_recipe_connector`, and native tools name their own registered function. The model must use that exact name, wait for setup when required, or ask the person to enable a native tool; it must not infer an alternative tool call.

Build discovery from the existing function, recipe, installation, connector, and project capability seams. Personal Chat may search the signed-in person's catalogue. Work limits recipes to project-enabled capabilities, connectors to those required by those recipes, tools to the effective project tool set, and installations to the current member's authority.

Render discovery through the existing custom tool `ResponseRenderer`. The renderer resolves recipe and connector IDs against freshly fetched catalogues before showing setup controls, reuses the normal connector and recipe configuration flows, and never executes setup automatically. Discovery results do not carry credentials, upstream session IDs, executable connector schemas, or trusted authorisation URLs.

Enable `trigger_recipe` and `use_recipe_connector` alongside discovery for signed-in Pro conversations so a ready recipe or connector has its canonical gateway available. In Work, direct connector use remains limited to providers and operation IDs declared by project-enabled recipes and revalidates project membership before connector discovery or execution. Native tools remain governed by the conversation or project's enabled-tool set; discovery reports them as not callable when their exact tool declaration is absent.

## Trade-offs

The discovery function adds a small default tool definition to every tool-capable request and may perform catalogue reads when the model chooses to call it. Result limits and schema bounds constrain that cost, while connector catalogue caching and future ranking improvements can reduce it further.

The two stable recipe and connector gateways also add schemas for signed-in Pro conversations. This avoids dead-end discovery without exposing every native tool schema, and the connector gateway still fails closed against recipe and project operation allowlists.

Readiness is deliberately coarser than runtime execution. The backend remains authoritative when a person installs a recipe, connects an account, or invokes a tool, so catalogue state can become stale without granting access or bypassing validation.
