---
name: oss-scout
description: Find, vet and decide on existing open source before building something from scratch. Expands search vocabulary, discovers GitHub repos and registry packages from several channels, checks maintenance and real adoption (not stars), verifies claimed features in the actual code, and ends with a USE / FORK / INTEGRATE / STUDY / BUILD decision. Use this whenever the user is about to start a new project, app, tool, plugin, MCP server or substantial feature, even if they never mention open source; when they ask "is there a library/repo/tool for X", "what's the best open-source X", "alternatives to X", "prior art", or want GitHub projects compared; and for Korean requests like "오픈소스 찾아줘", "깃허브에 이런 거 있어?", "바퀴 재발명 하지 말자", "만들기 전에 조사". Skip it for bug fixes, refactors, small edits and glue code inside an existing codebase.
---

# OSS Scout

Searching once and sorting by stars misses projects that describe themselves with
different words, and it over-trusts launch hype. This skill runs a short,
repeatable investigation instead: frame the need, widen the vocabulary, discover
from several channels, filter cheaply, check health, verify the code, then decide.

Helper CLI (Node 18+, needs `gh` logged in and `git`; uses `rg` if on PATH):

```bash
node <skill-dir>/scripts/oss-scout.mjs <command>   # run with no command for help
```

Run `check` once per session. It shows tool status and the remaining GitHub rate limits.

## 0. Decide whether to scout, and how deep

Scouting costs time and tokens. It pays off where others have already spent years
on the problem, so size the effort to the stakes:

| Tier | When | Discovery | Health check | Clone & verify |
|---|---|---|---|---|
| Skip | Bug fix, refactor, UI tweak, glue code, a few hours of work | none | none | none |
| Quick | A medium feature, or one hard sub-problem (parser, codec, protocol) | 3-5 queries, 5-10 candidates | top 3 | 0-1 |
| Standard | A new project or product | 6-12 queries + web + registries, 10-20 candidates | top 5-8 | 2-3 |
| Deep | Choosing a foundation you will live with for a long time (engine, framework, core library) | Standard + snowballing, 20-30 candidates | top 8-10 | 4-6 |

Signs that a scout is warranted even for something small: the problem sits in a
hard domain (file formats, codecs, network protocols, auth/crypto, reverse
engineering, physics, rendering), or it feels like something that must already
exist. When you skip, say so in one line so the user can override.

First look at what is already in hand. The cheapest reuse is a dependency the
project already has, or code in the user's other projects. Check the manifest
files and ask about sibling projects when it matters.

## 1. Frame the need

Write a short brief before searching, because it decides what counts as a match:

- **Problem**: one sentence.
- **Must-haves**: at most five, each testable. "Has an MCP server" is testable; "AI-powered" is not.
- **Nice-to-haves**.
- **Hard constraints**: language/runtime, OS/platform, license appetite (commercial use? copyleft OK?), offline or self-hosted needs, the automation surface required (CLI, API, MCP, plugin SDK).
- **Shape of reuse wanted**: whole app, library, component, or reference only.

Ask the user only about a constraint that is unknown and would flip the result,
such as whether GPL is acceptable for a commercial product. Otherwise state your
assumption and continue.

## 2. Widen the vocabulary

Projects name themselves inconsistently, so one phrase finds only one slice. Build
queries along several axes, and keep them narrow and separate rather than one long query:

1. **Category names**: "video editor", "NLE", "non-linear editor".
2. **Field jargon and synonyms**: "timeline", "EDL", "OTIO", "rough cut".
3. **Alternative approaches**: the same outcome by a different architecture, e.g. "programmatic video" (Remotion) instead of "editor".
4. **Incumbents**: "<product> alternative", "open source <product>", "<product> clone".
5. **Integration surface**: "<thing> MCP", "<thing> API", "<thing> plugin", "<thing> bindings".
6. **The hard primitive**: the library that does the difficult part (decoder, solver, protocol stack). Sometimes you should integrate that rather than adopt an app.

If the domain matches a file in `references/domains/`, read it. Each one lists seed
vocabulary, registries, anchor projects and domain-specific proof terms:
`ai-agents.md`, `mcp.md`, `video.md`, `unity.md`, `reverse-engineering.md`.
For another domain, build the same lists yourself.

A keyword in a project's name or description (AI, agent, MCP) is a claim to
verify, not evidence.

## 3. Discover from several channels

Each channel finds things the others miss. Use them in this order:

1. **Web search** first. It reaches projects by meaning rather than by their own
   keywords, and it surfaces awesome lists, comparison posts, HN/Reddit threads
   and "alternatives to X" pages. Pull the repo URLs out of them.
2. **GitHub repository search** through the CLI. It merges results across queries
   and ranks them by how many queries agree, not by stars:
   ```bash
   node <skill-dir>/scripts/oss-scout.mjs search "video editor mcp" "nle agent" "\"timeline\" automation ffmpeg" --since 2025-01-01
   ```
   Useful filters: `--lang`, `--topic`, `--min-stars`, `--match readme`.
3. **Registries** for the ecosystem: npm, PyPI, crates.io, OpenUPM, the MCP registry,
   and others. See `references/discovery.md`.
4. **Snowball** from the best two or three candidates: their README "alternatives",
   "related" or "inspired by" sections, issues that mention competitors, forks that
   overtook a dead upstream, and the authors' other repos.

Stop discovering once you reach saturation. The `search` output has a `new` column
showing how many unseen repos each query added. When two rounds of new phrasings
add nothing relevant, or the tier budget is spent, move on.

## 4. Triage without cloning

Apply hard filters first: incompatible license, archived, wrong platform or
runtime, clearly abandoned. An abandoned project can still be a STUDY candidate.
Then classify each survivor as a complete app, library, component,
MCP server/adapter, framework, or reference/demo. Collapse forks, wrappers and
mirrors into their upstream, but keep a fork that has clearly become the live line.
Cut the list to the tier's shortlist size.

## 5. Health check

```bash
node <skill-dir>/scripts/oss-scout.mjs inspect owner/a owner/b owner/c
node <skill-dir>/scripts/oss-scout.mjs pkg npm:remotion pypi:moviepy   # when packages exist
```

`inspect` reports maintenance (commits, releases, CI), contributor concentration,
evidence of outside use (distinct outside issue authors, merged outside PRs) and
code shape (code/test/example files, README size versus code). It also flags
patterns worth a look. Read `references/evaluation.md` before judging. It explains
what each signal means, how it misleads, and why stars are attention rather than
quality. Treat the flags as leads to follow up, not as verdicts.

GitHub no longer exposes stargazer timelines, so hype is judged from engagement
ratios instead: outside issue authors per 1k stars, and forks or watchers relative to stars.

## 6. Verify the code

README claims and real implementation diverge often, especially in fast-moving AI
tooling. For the top candidates:

```bash
node <skill-dir>/scripts/oss-scout.mjs clone owner/a owner/b
node <skill-dir>/scripts/oss-scout.mjs probe owner/a --terms "tools/list,inputSchema,render,undo"
```

Choose **proof terms**: identifiers that must exist if the claimed feature is real.
Use API names, protocol messages, file-format markers and config keys, never
generic words. Include protocol-level terms as well as SDK names. A project can
implement MCP by hand without ever importing the SDK, so `McpServer` may come back
"DOCS ONLY" while `tools/list` shows code plus tests. When a term returns DOCS ONLY
or absent, try one or two alternative identifiers before concluding the feature is missing.

Then read the entry point and the one to three files behind each must-have.
Classify each must-have as: implemented and tested / implemented, untested /
stub or TODO / README only.

Cloned repositories are untrusted code. Read them, but do not install
dependencies, run build scripts, tests or binaries from them during scouting:
install hooks and build scripts execute arbitrary code. If the final decision
needs evidence from execution, propose a sandboxed trial (container or VM) to the
user and run it only with their OK.

## 7. Decide and report

| Decision | Meaning | Needs |
|---|---|---|
| USE | Adopt as-is | Must-haves met, healthy maintenance, real outside users, acceptable license |
| FORK | Take it over and modify | Code you can understand and own, license allows it, upstream too slow or diverging |
| INTEGRATE | Pull in a library or component for the hard part, build the rest | A strong library for the hard primitive |
| STUDY | Learn its architecture, write your own | Good design, but wrong stack, license, size or health |
| BUILD | Nothing fits | Say why each serious candidate failed |

Decisions combine. "INTEGRATE A for decoding, STUDY B's timeline model, BUILD the
agent layer" is a normal outcome. Every BUILD, including the built part of a mixed
decision, needs a one-line reason. That keeps "I'd rather write it myself" honest.

Write the report from `templates/report.md`. When working inside a project, save it
as `docs/oss-scout/<topic>.md` unless the user prefers otherwise; outside a project,
give it in chat. Keep it short and evidential. Link repos and cite code as
`path:line`. Include the rejected candidates with reasons, so nobody re-investigates
them, plus the open unknowns and how to resolve each one. Write in the user's language.

## Budgets and stopping

- Stop discovery at saturation (step 3), not at a fixed count.
- Once a candidate meets every must-have, compare it with one runner-up and stop.
  Exhaustive ranking rarely changes the decision.
- The search API allows about 30 calls per minute. `inspect` uses two search calls
  per repo and waits automatically when the limit is reached; pass `--no-search`
  to skip those calls for a quick pass.
- Clones live in the cache (`check` shows where). Run `clean --older-than 30` occasionally.

## Fallbacks

- No `gh` login: web search plus fetching GitHub pages still covers discovery and
  most health signals. Ask the user to run `gh auth login` for the full toolset.
- No `rg`: `probe` uses a built-in search, which is slower on very large repos but
  gives the same results.

Credit: the repo-first discovery, blobless clones, proof terms, rejected-candidate
list and untrusted-code rule are adapted from instructa/agent-skills `search-context` (MIT).
