# claude-mods

My Claude Code mods. Each one lives in `mods/<name>/`.

## Mods

| # | Name | What it does |
|---|------|--------------|
| 1 | `crab-office` | Pixel crabs work in an office above the prompt. The main agent works alone; each subagent gets a crab that walks in, sits and types, then walks out. Crabs stay seated a few seconds so quick agents are seen. Total session tokens sit in the header; one agent picker lists working and finished agents. Pick one to see its files as a tree, its tool calls, tokens and todo progress. Questions show as a clear banner. Compact mode is one line. |

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
