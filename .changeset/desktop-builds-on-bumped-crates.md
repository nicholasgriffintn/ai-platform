---
"@assistant/desktop": patch
---

Let the desktop core build again after the dependency bumps.

`reqwest` moved to 0.13, which renamed the `rustls-tls` feature to `rustls`. The bump kept the old name, so the crate stopped resolving:

```
package `polychat-desktop` depends on `reqwest` with feature `rustls-tls`
but `reqwest` does not have that feature
```

Nothing caught it because the desktop workflow is what builds the core, and the bump landed without it running.
