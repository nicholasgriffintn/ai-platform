# Hosted computer worker

This worker hosts persistent Chromium desktops for teammate contexts. It is separate from the coding sandbox worker and keeps browser profiles in checkpointable container storage.

Configure a long random `COMPUTER_SCREEN_SECRET` for short-lived public screen sessions. The API reaches lifecycle endpoints through the `COMPUTER_WORKER` service binding at the private `computer.internal` origin; public hosts can only enter the authenticated screen gateway.

It also hosts one Hermes agent per paid member in the `AgentHost` container ([ADR 0086](../../.agents/skills/polychat-setup/references/architecture/decisions/0086-host-agent-runtimes-beside-the-sandbox.md)). Keep the `POLYCHAT_API` service binding and the R2 backup variables configured, because the container has no internet and reaches Polychat models and its checkpoints only through the Worker.

Deploy the worker before the API so the service binding resolves. Graphical validation requires a deployed container runtime: provision a context computer, navigate, checkpoint, destroy, restore and confirm that browser profile state survives.
