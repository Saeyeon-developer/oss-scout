# Discovery channels

GitHub repository search matches names, descriptions, topics and READMEs. Anything
described with different words is invisible to it, so combine channels.

## Web search query patterns

- `best open source <category> <year>`, `<category> open source github`
- `<incumbent product> alternative open source`, `<incumbent> clone github`
- `awesome <topic>` (curated lists, often the fastest map of a field)
- `site:news.ycombinator.com <topic>`; HN search: https://hn.algolia.com/?q=<topic>
- `site:reddit.com <topic> open source`, plus the relevant subreddit
- `<topic> vs <topic>` comparison posts: they name the real contenders and their tradeoffs
- `"we switched from" <project>`, `"migrated from" <project>`: post-mortems show failure modes
- Alternative-listing sites: alternativeto.net, opensourcealternative.to

Pull the GitHub URLs out of what you read and feed them to `inspect`.

## GitHub search tips

- Several narrow queries beat one broad query. `search` merges them and ranks by agreement.
- `--topic <t>` reaches projects that tagged themselves with a topic; check
  https://github.com/topics/<t> for related topics.
- `--match readme` finds projects whose names are unhelpful.
- `--since <date>` drops long-dead projects. Leave it off for STUDY-oriented
  searches, where old classics count.
- Search for awesome lists directly: `search "awesome <topic>"`.
- Code search finds *users* of a library, which is a good snowball and adoption
  signal: `gh search code "from moviepy import" --limit 30`. Code search has a
  much lower rate limit (about 10 per minute), so use it for targeted checks.

## Package registries (adoption and discovery)

| Ecosystem | Search | Downloads |
|---|---|---|
| JavaScript/TypeScript | https://www.npmjs.com/search?q= | `pkg npm:<name>` |
| Python | https://pypi.org/search/?q= | `pkg pypi:<name>` (pypistats; rate-limited) |
| Rust | https://crates.io/search?q= | `pkg crates:<name>` |
| .NET | https://www.nuget.org/packages?q= | shown on the package page |
| Go | https://pkg.go.dev/search?q= | "Imported by" count on the package page |
| Unity | https://openupm.com/packages/?q= | see `domains/unity.md` |
| Many ecosystems | https://libraries.io (dependents across registries) | page only; the API needs a key |

## Dependents

The repo page's "Used by" count (https://github.com/<owner>/<repo>/network/dependents)
lists repositories that depend on it. Open a few: are they real projects or forks
and tutorials?

## Snowballing from a good candidate

- README sections: "Alternatives", "Related projects", "Inspired by", "Prior art", "Comparison"
- Issues and discussions mentioning competitors: `repo:<o>/<r> "<competitor>"` in GitHub issue search
- The authors' other repos and the orgs they contribute to
- The forks network (https://github.com/<o>/<r>/forks?sort=stargazers or "Insights → Forks"),
  where an active fork can overtake a stale upstream
- Papers With Code / arXiv for research-backed fields: the paper's official
  implementation is often the reference
