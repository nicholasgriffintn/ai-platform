---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-utility-core": minor
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-component-content": minor
"@ngriffin_uk/polychat-component-conversation": minor
"@ngriffin_uk/polychat-component-capabilities": minor
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
"@assistant/sandbox-worker": minor
---

Forecast time series with Timestral, Mistral's time-series model, run on Polychat's own servers.

- **Forecasts app.** Paste or open a CSV, or start from a sample, choose which columns to forecast, and see where they are heading with shaded ranges rather than a single line. Columns you already know ahead, such as holidays or planned promotions, can fill the future rows and steer the forecast. Columns known only so far, such as observed temperature, can inform it too.
- **Forecasts in chat.** Ask where a metric is heading and the assistant passes the numbers to Timestral instead of guessing, then shows the forecast as a chart you can hover. Analytics Insights uses it for connected Plausible, PostHog and Metabase data.
- **API.** `POST /experiences/forecasts` takes up to eight series that share time steps, a horizon of up to 1,024 steps and optional covariates, and returns the quantiles you ask for.
