---
"@ngriffin_uk/polychat-config": minor
---

Share the Vite+ task preset every workspace package builds through.

Package builds are now Vite+ tasks rather than package.json scripts, and each one needs the same three unobvious pieces: a `dependsOn` entry for the `build` task of every direct workspace dependency, automatic input tracking with `dist/**` excluded so tsup reading back its own declaration output does not defeat the cache, and `dist/**` declared as the output to restore.

`@ngriffin_uk/polychat-config/tasks` exports `packageTaskConfig`, so a package's `vite.config.ts` is two lines naming only its build command.
