# Judging candidates: signals, traps, thresholds

Every number below is a lead, not a verdict. A single signal never decides. Look
for several independent signals that agree, and when they disagree, read the code.

## Contents
1. Attention is not quality
2. Signal table
3. Patterns worth recognising
4. What each decision needs
5. License quick reference

## 1. Attention is not quality

Stars measure how many people noticed a repo, usually during one launch week.
They can be bought. A 2024 study estimated millions of suspected fake stars on
GitHub (figure from memory, not re-checked here). Stars are also heavily
inflated for AI and agent projects that went viral on social media. Commit
counts are cheap too: AI-assisted development produces hundreds of commits a
month from one person. CI configs and test folders can be scaffolding that
checks nothing.

What is hard to fake is **other people depending on it**: outside users filing
specific issues, outside contributors getting PRs merged, downstream packages and
download counts, and maintainers responding over time.

## 2. Signal table

| Signal (from `inspect`) | Suggests | Misleads when | Rough read |
|---|---|---|---|
| Outside issue authors/yr | Real users hitting real problems | Bug-bounty spam, "how do I install" floods | ≥10 healthy; 0-2 for a 1k+ star repo means hardly anyone runs it |
| Outside issue authors per 1k stars | Use relative to attention | Libraries get fewer issues than apps | < 1 with 2k+ stars: attention far exceeds use |
| Outside merged PRs/yr | Others can work in the codebase, maintainers accept help | Typo/README PRs inflate it | ≥5 good; read a few titles |
| Contributor top share | Bus factor | Small focused libs are legitimately solo | > 90% means you depend on one person; fine for STUDY, risky for USE |
| Commits 90d | Active development | AI-generated churn, or a finished lib that needs nothing | Compare with releases and issue handling |
| Releases/yr, latest tag | Ships versions consumers can pin | Auto-release bots | 0 releases on an "app" makes upgrades painful |
| Issue close share, median days to close | Maintainer responsiveness | Auto-close stale bots inflate it | < 30% closed on a busy tracker: support is falling behind |
| Test files, CI green | Engineering discipline | Tests that only check the build; CI that lints | Probe: do tests exercise the must-have features? |
| README KB vs code KB | Substance | Docs-heavy projects legitimately have big docs folders | A big README over little code is a demo-ware smell |
| Age, stars/day | Launch dynamics | n/a | 1k+ stars in under 4 months: check whether usage matches |
| Package downloads (`pkg`) | Downstream adoption | CI installs inflate counts; mirrors deflate them | Compare candidates in the same ecosystem only |
| Dependents ("Used by" on the repo page) | Adoption by other projects | Forks and tutorials count | Check a few dependents for real projects |

## 3. Patterns worth recognising

- **Launch spike**: a large star count, young repo, few outside issue authors,
  many open issues untouched. Usually a demo. STUDY at most until usage catches up.
- **Solo power-builder**: one author at 90%+ of commits, very high commit rate,
  many tests, few outside users. Often well made (AI-assisted), but the future
  depends on one person. Prefer FORK/STUDY over USE for foundations, or accept the
  risk knowingly.
- **Quiet workhorse**: modest stars, years old, steady releases, many dependents,
  issues answered. Often the best USE/INTEGRATE choice. Easy to miss when sorting by stars.
- **Finished library**: few recent commits but closed issues, a stable API and
  heavy downloads. Low activity is not decay here.
- **README-first project**: feature lists, badges, roadmap items written as if
  done, but `probe` returns DOCS ONLY for the feature terms. Verify every must-have.
- **Wrapper of a wrapper**: thin layers over another project (an MCP wrapper
  around a CLI around a library). Evaluate the bottom layer. You may want it directly.
- **Fork that overtook upstream**: the upstream is stale and one fork has the
  activity. Adopt the fork, but note the governance risk.

## 4. What each decision needs

- **USE**: all must-haves verified in code, healthy maintenance, outside users,
  a compatible license, and an install and upgrade path you can live with.
- **FORK**: code you can read and own (size, structure, language you work in),
  a license that permits it, and acceptance that you inherit maintenance.
- **INTEGRATE**: a well-bounded library with a stable API and real downstream use.
  Health matters more than features here.
- **STUDY**: only design quality matters. License and health barely matter,
  but do not copy code across incompatible licenses.
- **BUILD**: every serious candidate failed a must-have or constraint, and the
  report says which.

## 5. License quick reference (not legal advice)

- Permissive (MIT, BSD, Apache-2.0): reuse and modify freely with attribution;
  Apache-2.0 adds a patent grant.
- Weak copyleft (LGPL, MPL-2.0): fine to link as a library; changes to the
  library's own files must be shared.
- Strong copyleft (GPL-2.0/3.0): distributing a combined work requires releasing it
  under GPL. Usually fine for internal tools, a problem for closed-source products.
- Network copyleft (AGPL-3.0): GPL plus an obligation when users interact over a
  network. A blocker for most closed SaaS.
- No license / NOASSERTION: all rights reserved by default. STUDY only, unless
  the author grants permission.
- "Source available" (BSL, SSPL, Commons Clause, custom "non-commercial"): not
  open source. Read the terms before any commercial use.
- Watch inherited obligations: FFmpeg builds with GPL components, model weights
  under separate licenses, and commercial tools a project requires (IDA, Hopper,
  Unity Asset Store assets).
