# Hosted computer worker

This worker hosts persistent Chromium desktops for teammate contexts. It is separate from the coding sandbox worker and keeps browser profiles in checkpointable container storage.

Configure a long random `COMPUTER_SCREEN_SECRET` for short-lived public screen sessions. The API reaches lifecycle endpoints through the `COMPUTER_WORKER` service binding at the private `computer.internal` origin; public hosts can only enter the authenticated screen gateway.

Deploy the worker before the API so the service binding resolves. Graphical validation requires a deployed container runtime: provision a context computer, navigate, checkpoint, destroy, restore and confirm that browser profile state survives.
