import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const apiInfoDescription = md`
# Polychat API

One API for models, teammates and the work they do. It accepts OpenAI-compatible request bodies and adds Polychat parameters on top, so an unmodified OpenAI client works and a Polychat-aware client can do more.

## Start here

- **Responses** run a model, a teammate or an agent. Every run anywhere in Polychat is a Response with one sequenced event stream.
- **Conversations** hold the items Responses produce.
- **Chat Completions** is an OpenAI-compatible port onto the same engine.
- **Models** lists what you can run. Pass \`model_tier\` instead of a model to let your plan pick.

## What else is here

- **Teammates, Poly, Skills and Memory** for configured agents that remember and learn.
- **Workspaces, Projects and Tasks** for shared work, boards and pull request reviews.
- **Environments, Machines and Jobs** for sandboxes, browsers, paired desktops and long-running work.
- **Outputs, Documents, Sources and Sites** for what gets made and what it is made from.
- **Recipes, Connectors, Channels and Webhooks** for integrations in and out.
- **The model platform** (registry, datasets, training, evaluation, serving and governance) for bringing your own models into a workspace.

## Authentication

Send a JWT or API key as a bearer token:

~~~http
Authorization: Bearer <jwt_or_api_key>
~~~

See Authentication for sign-in methods, including device sign-in for CLIs.

## Limits

Requests are rate limited per caller: 100 a minute when authenticated and 10 a minute otherwise. Model usage is metered in credits against your plan; read your balance at \`GET /usage/balance\` and the plans at \`GET /plans\`.

## Base URL

~~~
https://api.polychat.app
~~~

## Links

- **Issues**: [GitHub Issues](https://github.com/nicholasgriffintn/assistant/issues)
- **App**: [polychat.app](https://polychat.app)
- **Self-hosting**: use the repository's \`$polychat-setup\` agent skill.
`;
