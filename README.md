<p align="center">
  <img src="assets/themes/monk/icon.gif" alt="ahalo monk" width="120">
</p>

# ahalo

a blessing for your code. no bugs, no crashes, just vibes.

## install

```bash
npm install -g ahalo-cli
ahalo install
```

use `codex` or `claude` like normal — ahalo appears automatically.

## supported agents

- [openai codex cli](https://github.com/openai/codex) — fully supported
- [claude code](https://docs.anthropic.com/en/docs/claude-code) — fully supported

## commands

- `ahalo install` — activate the blessing
- `ahalo uninstall` — remove the blessing (not recommended)
- `ahalo status` — check if ahalo is watching
- `ahalo theme [name]` — switch to a different character

## custom themes

drop 3 gifs into `assets/themes/<name>/`:

- `icon.gif` — loop animation
- `icon_enter.gif` — entrance animation
- `icon_exit.gif` — exit animation

then: `ahalo theme <name>`

## notes

- macos only.
- works with any agent that has a hook/plugin system — PRs welcome!
