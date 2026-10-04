# Hosted computer worker

This worker hosts persistent Chromium desktops for teammate contexts. It is separate from the coding sandbox worker and keeps browser profiles in checkpointable container storage.

Configure a long random `COMPUTER_SCREEN_SECRET` for short-lived public screen sessions. The API reaches lifecycle endpoints through the `COMPUTER_WORKER` service binding at the private `computer.internal` origin; public hosts can only enter the authenticated screen gateway.

Deploy the worker before the API so the service binding resolves. Graphical validation requires a deployed container runtime: provision a context computer, navigate, checkpoint, destroy, restore and confirm that browser profile state survives.

## Verify Sites

The private `/computer/site-verify` endpoint creates a fresh temporary computer for a bounded Sites check. It accepts the shared capture schema, loads the structured preview document, captures browser diagnostics and destroys the computer after capture. Public hosts cannot call this endpoint.

Allow only the published app origin and its font origins. The Chromium request interceptor blocks other destinations, redirects to unapproved origins and URL credentials. Captures have no saved profile or connector credentials; private data arrives only in the ephemeral preview document.

Keep `cdp.py`, `read-page.py` and `verify-site.py` together in the container image. The shared debugger client accepts only the local Chromium debugger and validates its WebSocket handshake. Run `python3 -B -m unittest discover -s apps/computer-worker/test -p 'test_*.py'` from the repository root for protocol, destination and diagnostic checks.
