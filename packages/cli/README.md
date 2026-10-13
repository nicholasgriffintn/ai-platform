# @ngriffin_uk/polychat-cli

Pasting an API key into a server or gateway sends it through a clipboard and often a shell history. The CLI pairs the machine with a device code instead: it shows a code, you approve it at `/device` in the browser, and the machine gets its own key.

```sh
npx @ngriffin_uk/polychat-cli login
```

- `polychat login` pairs this machine. Pass `--name` to label the key and `--no-browser` to print the link instead of opening it.
- `polychat status` shows the account the saved key belongs to.
- `polychat token` prints the key, for example `OPENAI_API_KEY=$(polychat token)` in a gateway config.
- `polychat logout` forgets the key locally. Revoke it under Profile, API keys to cut the machine off.

Keys are stored per API address in `~/.config/polychat/credentials.json` with owner-only permissions. Set `--api` or `POLYCHAT_API_URL` to use another instance, and `POLYCHAT_CONFIG_DIR` to move the file. Plain http is only accepted for localhost.
