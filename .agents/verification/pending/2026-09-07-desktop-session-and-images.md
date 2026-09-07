# The desktop window stays signed in and shows the images the API serves

- **Change:** the desktop window renews its access token from the lifetime the API reports and again on focus or reconnect, and the packaged content security policy admits the API origin and the avatar hosts.
- **Surfaces:** desktop.
- **Prerequisites:** none.
- **Risk if wrong:** a window left alone or woken from sleep silently fails every API request, and avatars, uploads and generated images stay blank in the packaged application while working in development.
- **Commits:** this change.

## Verify

- [ ] Sign in to a packaged build and confirm the account avatar renders in the sidebar settings popover.
- [ ] Send a message that returns an image or open a conversation holding an upload, and confirm the image renders rather than showing a broken placeholder.
- [ ] Leave the window signed in and idle for twenty minutes, or sleep the machine and wake it, then send a message without reloading and confirm it succeeds.
- [ ] Sign out from another device to revoke the session, then focus the desktop window and confirm it returns to the sign-in screen rather than failing silently.
- [ ] Save a pairing secret against a model runtime that requires one, then discover its models and confirm the runtime accepts the request.

**Stop and report if:** the window keeps showing a signed-in shell while every request fails, or images served by the API stay blank with a content security policy refusal in the developer console.
