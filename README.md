> 바퀴를 재발명하지 마세요.

# OSS Scout

An agent skill for Claude Code and Codex. Before you build something from scratch,
it finds, vets and decides on existing open source.

## Why

Searching once and sorting by stars misses projects that describe themselves in
different words, and it over-trusts launch hype. In AI and agent tooling, a
five-figure star count with no tests and no outside users is common. OSS Scout runs
a short, repeatable investigation instead:

1. **Gate**: decide whether a scout is worth it (Skip / Quick / Standard / Deep).
2. **Frame**: write down the must-haves, constraints and the kind of reuse wanted.
3. **Widen the vocabulary**: category names, jargon, alternative approaches, incumbents, integration surfaces, the hard primitive.
4. **Discover from several channels**: web search, GitHub search, package registries, snowballing. Stop at saturation.
5. **Triage**: hard filters, classification, collapsing forks.
6. **Health check**: outside users and contributors, maintenance, code shape. Stars are not the measure.
7. **Verify the code**: proof terms show whether a claimed feature lives in code and tests or only in the README.
8. **Decide**: **USE / FORK / INTEGRATE / STUDY / BUILD**, with rejected candidates and reasons.

## The helper CLI

`scripts/oss-scout.mjs` has no dependencies. It needs Node 18+, an authenticated
[`gh`](https://cli.github.com/) and `git`, and uses `rg` when it is on PATH.

```bash
node scripts/oss-scout.mjs check                                   # tools, auth, rate limits
node scripts/oss-scout.mjs search "video editor mcp" "nle agent"   # merged multi-query repo search
node scripts/oss-scout.mjs inspect owner/a owner/b                 # adoption & maintenance signals
node scripts/oss-scout.mjs pkg npm:remotion pypi:moviepy           # registry downloads
node scripts/oss-scout.mjs clone owner/a                           # blobless shallow clone (never runs code)
node scripts/oss-scout.mjs probe owner/a --terms "tools/list,undo" # code vs tests vs docs
```

Example `inspect` output (abridged):

```
| repo        | stars | commits 90d | contributors (top share) | outside issue authors/yr | per 1k stars | outside PRs/yr | test files |
| ...-pro     | 15k   | 258         | 21 (92%)                 | 65                       | 4.5          | 73             | 198        |
| ...-story   | 3.5k  | 1           | 8 (37%)                  | 31                       | 8.9          | 27             | 0          |
```

Example `probe` output:

```
| term       | verdict    | code | tests | docs |
| McpServer  | DOCS ONLY  | 0    | 0     | 4    |
| tools/list | code+tests | 1    | 2     | 0    |   <- hand-rolled MCP, but real and tested
```

## Install

Copy or symlink this folder into your skills directory:

- Claude Code: `~/.claude/skills/oss-scout/`
- Codex: your Codex skills directory (see the Codex docs)

The skill triggers on its own when you are about to start a new project or a
substantial feature, or when you ask things like "is there a library for X" or
"오픈소스 찾아줘". Clones and run logs go to `%LOCALAPPDATA%\oss-scout` on Windows
and `~/.cache/oss-scout` elsewhere (override with `OSS_SCOUT_HOME`).

## Layout

```
SKILL.md                      workflow the agent follows
scripts/oss-scout.mjs         helper CLI
references/evaluation.md      how to read signals, hype patterns, license notes
references/discovery.md       channels, query patterns, registries
references/domains/*.md       ai-agents, mcp, video, unity, reverse-engineering
templates/report.md           decision report template
```

## Notes and limits

- GitHub no longer exposes stargazer timelines through its API, so hype is judged
  from engagement ratios (outside issue authors per 1k stars, forks or watchers per star).
- The search API allows about 30 calls per minute. `inspect` waits automatically
  when it hits the limit; `--no-search` skips those calls.
- Cloned repositories are treated as untrusted. The skill reads them and never
  installs, builds or runs them.
- Anchor projects in `references/domains/` are starting points written in 2026.
  Verify them before relying on them.
- All signals are heuristics. Read the code before deciding.

## Credits

The repo-first discovery, blobless clones, proof terms, rejected-candidate list and
untrusted-code rule are adapted from
[instructa/agent-skills `search-context`](https://github.com/instructa/agent-skills/tree/main/skills/engineering/search-context) (MIT).

## License

[MIT](LICENSE)
