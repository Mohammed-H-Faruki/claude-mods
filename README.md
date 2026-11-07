# claude-mods

My Claude Code mods. Each one lives in `mods/<name>/`.

## Mods

| # | Name | What it does |
|---|------|--------------|
| 1 | `crab-office` | A pixel-art office above the prompt. The main crab works at its desk and naps when idle; each subagent gets a crab that walks in, works, and leaves. Crabs visit the library (searches, web), tool rack (commands, MCP tools) and skills cabinet (skills, plugins), and take coffee breaks on long tasks. The bar has Now, History, Details and Actions tabs, a session token total, and a 🔔 alert when something needs your approval. Compact mode is one line. |

## Install (for Claude Code: read this part)

The user pastes the link to this repository and may name a mod by number or name.

1. **Pick the mod.**
   - The user gave a number or a name: match it against the table above.
   - The user gave neither, or it matches nothing: show the table and ask which mod to install. Wait for the answer.
2. **Install it.** Run these two commands, with `<name>` the mod's name from the table:

   ```bash
   claude plugin marketplace add Mohammed-H-Faruki/claude-mods
   claude plugin install <name>@claude-mods
   ```

   If the first command says the marketplace already exists, skip it and run the second.
   If it cannot reach the repository (it is private), tell the user to log in to GitHub on this computer (`gh auth login`, or sign in when git asks) and run the command again.
3. **Finish.** Say only: "Done. Start a new session and the mod loads by itself." Do not explain the mod or ask follow-up questions.

## Install (by hand)

```bash
claude plugin marketplace add Mohammed-H-Faruki/claude-mods
claude plugin install crab-office@claude-mods
```

Start a new Claude Code session afterwards.

## Update

```bash
claude plugin marketplace update claude-mods
claude plugin update crab-office@claude-mods
```

## Add a new mod (for Claude Code)

Copy the finished mod folder (without `.claude-plugin/types/`) to `mods/<name>/`, add a row to the table above and an entry to `.claude-plugin/marketplace.json` with `"source": "./mods/<name>"`, then commit and push.
