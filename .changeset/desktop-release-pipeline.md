---
"@assistant/api": minor
"@assistant/app": minor
"@assistant/desktop": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-utility-core": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
---

Release the applications from changesets. Merging a changeset that names an application versions it, tags it and publishes a GitHub release with its changelog entry; the desktop release also carries macOS, Windows and Linux archives built on their own runners. The API serves those archives from `/desktop/downloads` and answers the desktop updater from `/desktop/releases`, so neither the website nor the application needs to know where the builds are hosted.
