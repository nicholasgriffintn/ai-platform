---
"@ngriffin_uk/polychat-utility-server": patch
---

Strip authentication headers when following a redirect to another origin. Preserve HEAD requests on 303 redirects and clear body headers when converting a request to GET.
