---
"@assistant/app": minor
"@assistant/desktop": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-library-react": minor
---

Give the desktop window the Teammates place, the teammate editor and the tool runner.

Teammates was the last of the three places the shared sidebar links to that the desktop answered with a 404, and it carried the largest tail: the capability library and its dialogs, the recipe workflow controller, the connector setup dialogs and the teammate editor all lived in `apps/app`.

They move into `component-shell` unchanged, and both hosts render the same library, the same hire, share and skill dialogs, and the same connector setup. `library-react` publishes `NEW_TEAMMATE_ID` beside `getTeammateEditorPath`, so the constant belongs with the paths that use it rather than to whichever page happened to define it.

The desktop still answers 404 for `/chat/apps/:appId`, which needs the application runtimes rather than the capability library.
