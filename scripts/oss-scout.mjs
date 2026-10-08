#!/usr/bin/env node
// OSS Scout CLI: discovery, health inspection, cloning and code probing of GitHub
// repositories, used to decide whether to reuse existing open source before building.
// Zero dependencies. Needs node 18+, gh (authenticated) and git. Uses rg when available.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DAY = 86400000;
const NOW = Date.now();
const HOME = process.env.OSS_SCOUT_HOME || defaultHome();

const HELP = `oss-scout <command> [args]

  check                                  Tools, gh auth and remaining API rate limits
  search "<query>" ["<query>" ...]       GitHub repository search, merged across queries
        [--lang L] [--topic T] [--min-stars N] [--since YYYY-MM-DD]
        [--limit N per query, default 20] [--sort stars|updated] [--match name|description|readme]
  inspect <owner/repo|url> ...           Maintenance, adoption and code-shape signals
        [--no-search]                    (skip issue/PR signals that use the search API)
  pkg <eco:name> ...                     Registry downloads (npm:, pypi:, crates:)
  clone <owner/repo|url> ... [--refresh] Blobless shallow clone into the cache (never runs code)
  probe <path|owner/repo> --terms "a,b"  Where proof terms occur: code vs tests vs examples vs docs
  clean [--older-than DAYS]              Delete cached clones older than DAYS (default 30)

Cache: ${HOME}  (override with OSS_SCOUT_HOME)
Add --json to search/inspect/probe to print JSON instead of Markdown.`;

function defaultHome() {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, 'oss-scout');
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'oss-scout');
}

// ---------- small utilities ----------

const BOOL_FLAGS = new Set(['no-search', 'refresh', 'json', 'help']);

function parseArgs(argv) {
  const out = { _: [], f: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { out._.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      let [k, v] = a.slice(2).split(/=(.*)/s);
      if (v === undefined) v = BOOL_FLAGS.has(k) ? true : argv[++i];
      out.f[k] = v;
    } else out._.push(a);
  }
  return out;
}

function die(msg) { console.error(`oss-scout: ${msg}`); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true, ...opts });
  if (r.error) return { ok: false, status: -1, stdout: '', stderr: r.error.message };
  return { ok: r.status === 0, status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runAsync(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    const p = spawn(cmd, args, { windowsHide: true, ...opts });
    p.stdout.setEncoding('utf8').on('data', (d) => { stdout += d; });
    p.stderr.setEncoding('utf8').on('data', (d) => { stderr += d; });
    p.on('error', (e) => resolve({ ok: false, status: -1, stdout, stderr: e.message }));
    p.on('close', (code) => resolve({ ok: code === 0, status: code, stdout, stderr }));
  });
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

function isoDaysAgo(n) { return new Date(NOW - n * DAY).toISOString().slice(0, 10); }
function daysSince(iso) { return iso ? Math.floor((NOW - Date.parse(iso)) / DAY) : null; }
function day(iso) { return iso ? String(iso).slice(0, 10) : '-'; }
function pct(x) { return x == null ? '-' : `${Math.round(x * 100)}%`; }
function kfmt(n) { return n == null ? '-' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n); }
function trunc(s, n) { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function median(xs) { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function round1(x) { return x == null || !isFinite(x) ? null : Math.round(x * 10) / 10; }

function mdTable(head, rows) {
  const esc = (c) => String(c ?? '').replace(/\|/g, '\\|');
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');
}

function parseRepo(s) {
  const t = String(s).trim()
    .replace(/^git@github\.com:/, '')
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/^github\.com\//, '');
  const [owner, name] = t.split(/[/?#]/);
  if (!owner || !name) die(`not a GitHub repository: ${s}`);
  return `${owner}/${name.replace(/\.git$/, '')}`;
}

function saveRun(kind, data) {
  const dir = path.join(HOME, 'runs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

// Split a query into gh search arguments, keeping "quoted phrases" together.
function tokenize(q) {
  const out = [];
  for (const m of String(q).matchAll(/"([^"]+)"|(\S+)/g)) out.push(m[1] !== undefined ? `"${m[1]}"` : m[2]);
  return out;
}

// ---------- gh API wrappers ----------

async function gh(apiPath, { include = false } = {}) {
  const args = ['api'];
  if (include) args.push('-i');
  args.push(apiPath);
  const r = await runAsync('gh', args);
  let body = r.stdout;
  const headers = {};
  if (include) {
    const sep = body.match(/\r?\n\r?\n/);
    if (sep) {
      for (const line of body.slice(0, sep.index).split(/\r?\n/).slice(1)) {
        const i = line.indexOf(':');
        if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
      }
      body = body.slice(sep.index + sep[0].length);
    }
  }
  let json = null;
  try { json = body.trim() ? JSON.parse(body) : null; } catch { /* non-JSON body */ }
  return { ok: r.ok, json, headers, stderr: r.stderr.trim() };
}

function lastPage(link) {
  const m = /[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(link || '');
  return m ? Number(m[1]) : null;
}

// Count list items cheaply: request one item per page and read the last page number.
async function countItems(apiPath) {
  const r = await gh(`${apiPath}${apiPath.includes('?') ? '&' : '?'}per_page=1`, { include: true });
  if (!r.ok) return null;
  return lastPage(r.headers.link) ?? (Array.isArray(r.json) ? r.json.length : null);
}

// The search API allows ~30 requests/minute: serialize search calls, space them out, retry on limits.
let searchChain = Promise.resolve();
function throttledSearch(fn) {
  const task = searchChain.then(async () => {
    let r = await fn();
    for (let attempt = 0; attempt < 2 && !r.ok && /rate limit|secondary|abuse|403/i.test(r.stderr); attempt++) {
      const rl = await gh('rate_limit');
      const reset = rl.json?.resources?.search?.reset;
      const wait = Math.min(65000, Math.max(3000, reset ? reset * 1000 - Date.now() + 1500 : 30000));
      console.error(`  search API limit reached, waiting ${Math.round(wait / 1000)}s ...`);
      await sleep(wait);
      r = await fn();
    }
    await sleep(2100);
    return r;
  });
  searchChain = task.catch(() => {});
  return task;
}
const ghSearch = (apiPath) => throttledSearch(() => gh(apiPath));

// ---------- path classification (shared by inspect and probe) ----------

const RE_VENDOR = /(^|\/)(node_modules|vendor|third[_-]?party|external|dist|build|out|target|\.git)(\/|$)|\.min\.(js|css)$|\.map$/i;
const RE_TEST = /(^|\/)(tests?|__tests__|specs?|testing|e2e)(\/|$)|[._-](test|spec)s?\.[a-z0-9]+$|(^|\/)test_[^/]+\.py$|Tests?\.(cs|swift|kt|java)$/i;
const RE_EXAMPLE = /(^|\/)(examples?|samples?|demos?|playground|showcase)(\/|$)/i;
const RE_DOC = /(^|\/)(docs?|documentation|wiki)(\/|$)|(^|\/)(readme|changelog|contributing|license)[^/]*$|\.(md|mdx|rst|adoc|txt)$/i;
const RE_CODE = /\.(c|cc|cpp|cxx|h|hh|hpp|cs|go|rs|java|kt|kts|swift|m|mm|py|pyx|js|jsx|ts|tsx|mjs|cjs|rb|php|lua|dart|scala|zig|nim|ex|exs|erl|hs|ml|clj|vue|svelte|shader|hlsl|glsl|compute|cginc|gd|sh|ps1|sql)$/i;
const RE_CI = /^\.github\/workflows\/[^/]+\.ya?ml$|^\.gitlab-ci\.yml$|^\.circleci\/|^azure-pipelines\.yml$|^\.travis\.yml$/i;
const MANIFESTS = /(^|\/)(package\.json|pyproject\.toml|setup\.py|requirements\.txt|Cargo\.toml|go\.mod|pom\.xml|build\.gradle(\.kts)?|CMakeLists\.txt|meson\.build|Makefile|Package\.swift|[^/]+\.sln|[^/]+\.csproj|Packages\/manifest\.json|ProjectSettings\/ProjectVersion\.txt|Dockerfile|docker-compose\.ya?ml|server\.json|smithery\.yaml|mcp\.json|plugin\.json)$/;
const BOT_AUTHORS = ['app/dependabot', 'app/renovate', 'app/github-actions', 'app/copilot-swe-agent', 'app/pre-commit-ci'];

function classify(p) {
  if (RE_VENDOR.test(p)) return 'vendor';
  if (RE_TEST.test(p)) return 'test';
  if (RE_EXAMPLE.test(p)) return 'example';
  if (RE_DOC.test(p)) return 'doc';
  if (RE_CODE.test(p)) return 'code';
  return 'other';
}

// ---------- check ----------

async function cmdCheck() {
  const rows = [['node', process.version]];
  for (const tool of ['gh', 'git', 'rg']) {
    const r = run(tool, ['--version']);
    rows.push([tool, r.ok ? r.stdout.split(/\r?\n/)[0] : tool === 'rg' ? 'not on PATH (built-in fallback search will be used)' : 'MISSING']);
  }
  const auth = run('gh', ['auth', 'status']);
  rows.push(['gh auth', auth.ok ? 'logged in' : 'NOT logged in (run: gh auth login)']);
  const rl = await gh('rate_limit');
  if (rl.ok && rl.json?.resources) {
    for (const k of ['core', 'search', 'code_search', 'graphql']) {
      const x = rl.json.resources[k];
      if (x) rows.push([`rate ${k}`, `${x.remaining}/${x.limit} (resets ${new Date(x.reset * 1000).toLocaleTimeString()})`]);
    }
  }
  rows.push(['cache', HOME]);
  console.log(mdTable(['item', 'status'], rows));
}

// ---------- search ----------

async function cmdSearch(a) {
  const queries = a._;
  if (!queries.length) die('search needs at least one query');
  const limit = String(a.f.limit ?? 20);
  const extra = [];
  if (a.f.lang) extra.push('--language', a.f.lang);
  if (a.f.topic) extra.push('--topic', a.f.topic);
  if (a.f['min-stars']) extra.push('--stars', `>=${a.f['min-stars']}`);
  if (a.f.since) extra.push('--updated', `>=${a.f.since}`);
  if (a.f.sort) extra.push('--sort', a.f.sort);
  if (a.f.match) extra.push('--match', a.f.match);
  const fields = 'fullName,description,stargazersCount,forksCount,language,license,pushedAt,createdAt,isArchived,isFork,url';

  const found = new Map();
  const saturation = [];
  for (const [qi, q] of queries.entries()) {
    const r = await throttledSearch(() => runAsync('gh', ['search', 'repos', ...extra, '--limit', limit, '--json', fields, '--', ...tokenize(q)]));
    if (!r.ok) { saturation.push({ query: q, error: r.stderr.trim().split(/\r?\n/)[0] }); continue; }
    const items = JSON.parse(r.stdout || '[]');
    let fresh = 0;
    items.forEach((it, rank) => {
      let e = found.get(it.fullName);
      if (!e) { e = { ...it, queries: [], score: 0 }; found.set(it.fullName, e); fresh++; }
      e.queries.push(qi + 1);
      e.score += 1 / (10 + rank); // reciprocal-rank fusion: rewards repos that several queries agree on
    });
    saturation.push({ query: q, results: items.length, new: fresh });
  }

  const candidates = [...found.values()].sort((x, y) => y.score - x.score).map((c) => {
    const flags = [];
    if (c.isArchived) flags.push('archived');
    if (c.isFork) flags.push('fork');
    if (!c.license?.key) flags.push('no-license');
    else if (c.license.key === 'other') flags.push('license:other');
    if (daysSince(c.pushedAt) > 365) flags.push('stale');
    if (daysSince(c.createdAt) < 90) flags.push('young');
    return { ...c, flags };
  });
  const data = { at: new Date().toISOString(), queries, filters: a.f, saturation, candidates };
  const file = saveRun('search', data);
  if (a.f.json) return console.log(JSON.stringify(data, null, 2));

  console.log('## Query saturation\n');
  console.log(mdTable(['#', 'query', 'results', 'new'], saturation.map((s, i) => [i + 1, s.query, s.error ? `ERROR ${s.error}` : s.results, s.new ?? '-'])));
  console.log(`\n## Candidates (${candidates.length}), ranked by agreement across queries, not by stars\n`);
  console.log(mdTable(['#', 'repo', 'stars', 'lang', 'pushed', 'license', 'queries', 'flags', 'description'],
    candidates.map((c, i) => [i + 1, c.fullName, kfmt(c.stargazersCount), c.language || '-', day(c.pushedAt), c.license?.key || '-', c.queries.join(','), c.flags.join(' '), trunc(c.description, 90)])));
  console.log(`\nSaved: ${file}`);
}

// ---------- inspect ----------

async function inspectRepo(full, opts) {
  const metaR = await gh(`repos/${full}`);
  if (!metaR.ok || !metaR.json?.full_name) return { repo: full, error: trunc(metaR.stderr, 200) };
  const m = metaR.json;
  full = m.full_name;
  const branch = encodeURIComponent(m.default_branch);
  const out = {
    repo: full, url: m.html_url, description: m.description, language: m.language, topics: m.topics,
    stars: m.stargazers_count, forks: m.forks_count, watchers: m.subscribers_count,
    license: m.license?.spdx_id || null, archived: m.archived, fork: m.fork, parent: m.parent?.full_name || null,
    createdAt: m.created_at, pushedAt: m.pushed_at, defaultBranch: m.default_branch, homepage: m.homepage || null,
    openIssuesAndPRs: m.open_issues_count, ageDays: daysSince(m.created_at), pushedDaysAgo: daysSince(m.pushed_at), errors: [],
  };
  const note = (what, r) => { if (!r.ok) out.errors.push(`${what}: ${trunc(r.stderr, 100)}`); return r.ok; };

  const [cr, c90, c365, rr, tr, ci] = await Promise.all([
    gh(`repos/${full}/contributors?per_page=100`, { include: true }),
    countItems(`repos/${full}/commits?since=${isoDaysAgo(90)}T00:00:00Z`),
    countItems(`repos/${full}/commits?since=${isoDaysAgo(365)}T00:00:00Z`),
    gh(`repos/${full}/releases?per_page=100`),
    gh(`repos/${full}/git/trees/${branch}?recursive=1`),
    gh(`repos/${full}/actions/runs?per_page=50&branch=${branch}&created=>=${isoDaysAgo(120)}`),
  ]);

  // Contributors: concentration matters more than raw count.
  if (note('contributors', cr) && Array.isArray(cr.json)) {
    const humans = cr.json.filter((c) => !/\[bot\]$/i.test(c.login || ''));
    const total = humans.reduce((s, c) => s + c.contributions, 0) || 1;
    const pages = lastPage(cr.headers.link);
    out.contributors = {
      count: pages ? `${(pages - 1) * 100}+` : humans.length,
      top: humans[0]?.login || null,
      topShare: humans.length ? humans[0].contributions / total : null,
      withTenPlusCommits: humans.filter((c) => c.contributions >= 10).length,
    };
  }
  out.commits = { last90d: c90, last365d: c365 };

  if (note('releases', rr) && Array.isArray(rr.json)) {
    const rel = rr.json.filter((r) => !r.draft);
    out.releases = { count: rel.length >= 100 ? '100+' : rel.length, last365d: rel.filter((r) => daysSince(r.published_at) <= 365).length, latest: rel[0]?.published_at || null, latestTag: rel[0]?.tag_name || null };
  }

  // File tree: shape of the code without cloning.
  if (note('tree', tr) && Array.isArray(tr.json?.tree)) {
    const blobs = tr.json.tree.filter((t) => t.type === 'blob');
    const cats = { code: 0, test: 0, example: 0, doc: 0, other: 0, vendor: 0 };
    let codeBytes = 0, readmeBytes = 0;
    for (const b of blobs) {
      const c = classify(b.path);
      cats[c]++;
      if (c === 'code') codeBytes += b.size || 0;
      if (/^readme(\.[a-z]+)?$/i.test(b.path)) readmeBytes = b.size || 0;
    }
    out.tree = {
      truncated: !!tr.json.truncated, files: blobs.length, codeFiles: cats.code, testFiles: cats.test, exampleFiles: cats.example,
      docFiles: cats.doc, codeKB: Math.round(codeBytes / 1024), readmeKB: Math.round(readmeBytes / 1024),
      ciWorkflows: blobs.filter((b) => RE_CI.test(b.path)).length,
      manifests: blobs.map((b) => b.path).filter((p) => MANIFESTS.test(p) && p.split('/').length <= 3).slice(0, 15),
    };
  }

  // CI: only real workflow runs on the default branch in the last 120 days (skip Copilot/Dependabot "dynamic" runs).
  if (ci.ok && Array.isArray(ci.json?.workflow_runs)) {
    const runs = ci.json.workflow_runs.filter((r) => r.event !== 'dynamic' && !String(r.path || '').startsWith('dynamic/'));
    const s = runs.filter((r) => r.conclusion === 'success').length;
    const f = runs.filter((r) => r.conclusion === 'failure').length;
    out.ci = { recentRuns: runs.length, successRate: s + f ? s / (s + f) : null, lastRunAt: runs[0]?.created_at || null };
  }

  // Search-API signals: are other people using it, and do maintainers respond?
  if (!opts.noSearch) {
    const since = isoDaysAgo(365);
    const insiders = [...new Set([m.owner?.login, out.contributors?.top].filter(Boolean).map((x) => x.toLowerCase()))];
    const iss = await ghSearch(`search/issues?per_page=100&q=${encodeURIComponent(`repo:${full} is:issue created:>=${since}`)}`);
    if (note('issue search', iss) && iss.json) {
      const items = iss.json.items || [];
      const authors = new Set(items.map((i) => i.user?.login).filter((l) => l && !/\[bot\]$/i.test(l) && !insiders.includes(l.toLowerCase())));
      const closed = items.filter((i) => i.state === 'closed');
      out.issues365d = {
        opened: iss.json.total_count, sample: items.length, distinctOutsideAuthors: authors.size,
        closedShareOfSample: items.length ? closed.length / items.length : null,
        medianDaysToClose: round1(median(closed.filter((i) => i.closed_at).map((i) => (Date.parse(i.closed_at) - Date.parse(i.created_at)) / DAY))),
      };
    }
    const excl = [...insiders, ...BOT_AUTHORS].map((l) => ` -author:${l}`).join('');
    const prs = await ghSearch(`search/issues?per_page=1&q=${encodeURIComponent(`repo:${full} is:pr is:merged merged:>=${since}${excl}`)}`);
    if (note('PR search', prs) && prs.json) out.externalMergedPRs365d = prs.json.total_count;
  }

  // Attention vs. use. GitHub no longer exposes stargazer timelines, so compare stars with evidence of real use.
  const k = out.stars / 1000;
  out.engagement = {
    starsPerDay: round1(out.stars / Math.max(1, out.ageDays)),
    forksPer100Stars: round1(out.stars ? (out.forks / out.stars) * 100 : null),
    watchersPer1kStars: round1(k ? out.watchers / k : null),
    outsideIssueAuthorsPer1kStars: out.issues365d && k ? round1(out.issues365d.distinctOutsideAuthors / k) : null,
  };

  out.signals = deriveSignals(out);
  if (!out.errors.length) delete out.errors;
  return out;
}

function deriveSignals(o) {
  const warn = [], good = [];
  if (o.archived) warn.push('archived');
  if (o.fork) warn.push(`fork of ${o.parent || '?'}`);
  if (!o.license || o.license === 'NOASSERTION') warn.push('no or unclear license');
  if (o.pushedDaysAgo > 180) warn.push(`no push for ${o.pushedDaysAgo}d`);
  if (o.ageDays < 90) warn.push(`young (${o.ageDays}d)`);
  const c = o.contributors;
  if (c && (c.count <= 2 || c.topShare > 0.9)) warn.push(`single-maintainer (top author ${pct(c.topShare)} of commits)`);
  if (o.tree) {
    if (o.tree.testFiles === 0) warn.push('no test files');
    if (o.tree.ciWorkflows === 0 && !o.ci?.recentRuns) warn.push('no CI');
    if (o.tree.codeKB < 200 && o.tree.readmeKB * 4 > o.tree.codeKB) warn.push('README large relative to code');
    if (o.tree.testFiles >= 10) good.push(`${o.tree.testFiles} test files`);
  }
  if (o.ci?.successRate != null && o.ci.recentRuns >= 5) {
    if (o.ci.successRate >= 0.85) good.push(`CI ${pct(o.ci.successRate)} green`);
    else if (o.ci.successRate < 0.6) warn.push(`CI only ${pct(o.ci.successRate)} green`);
  }
  if (o.releases && o.releases.count === 0) warn.push('no releases');
  if (o.releases?.last365d >= 2) good.push(`${o.releases.last365d} releases/yr`);
  if (o.commits?.last90d >= 10) good.push(`${o.commits.last90d} commits/90d`);
  const is = o.issues365d;
  if (is) {
    if (is.distinctOutsideAuthors >= 10) good.push(`${is.distinctOutsideAuthors}${is.sample >= 100 ? '+' : ''} outside issue authors/yr`);
    if (is.sample >= 10 && is.closedShareOfSample < 0.3) warn.push(`only ${pct(is.closedShareOfSample)} of recent issues closed`);
  }
  if (o.externalMergedPRs365d >= 5) good.push(`${o.externalMergedPRs365d} outside PRs merged/yr`);
  const e = o.engagement;
  if (o.stars >= 2000 && e.outsideIssueAuthorsPer1kStars != null && is.sample < 100 && e.outsideIssueAuthorsPer1kStars < 1)
    warn.push(`attention >> usage: ${e.outsideIssueAuthorsPer1kStars} outside issue authors per 1k stars`);
  if (o.stars >= 1000 && o.ageDays < 120) warn.push(`fast star growth (${e.starsPerDay}/day since creation) - check for launch hype`);
  return { good, warn };
}

async function cmdInspect(a) {
  const repos = [...new Set(a._.map(parseRepo))];
  if (!repos.length) die('inspect needs at least one owner/repo');
  const results = await pool(repos, 4, async (r) => { console.error(`inspecting ${r} ...`); return inspectRepo(r, { noSearch: !!a.f['no-search'] }); });
  const file = saveRun('inspect', { at: new Date().toISOString(), results });
  if (a.f.json) return console.log(JSON.stringify(results, null, 2));

  const ok = results.filter((r) => !r.error);
  console.log('## Comparison\n');
  console.log(mdTable(['repo', 'stars', 'license', 'age', 'last push', 'commits 90d', 'contributors (top share)', 'outside issue authors/yr', 'per 1k stars', 'outside PRs/yr', 'test files', 'CI green', 'releases/yr'],
    ok.map((r) => [r.repo, kfmt(r.stars), r.license || '-', `${r.ageDays}d`, `${r.pushedDaysAgo}d ago`, r.commits?.last90d ?? '-',
      r.contributors ? `${r.contributors.count} (${pct(r.contributors.topShare)})` : '-', r.issues365d?.distinctOutsideAuthors ?? '-',
      r.engagement.outsideIssueAuthorsPer1kStars ?? '-', r.externalMergedPRs365d ?? '-', r.tree?.testFiles ?? '-', pct(r.ci?.successRate), r.releases?.last365d ?? '-'])));
  for (const r of results) {
    console.log(`\n### ${r.repo}`);
    if (r.error) { console.log(`ERROR: ${r.error}`); continue; }
    console.log(`${trunc(r.description, 200)}\n`);
    console.log(`- ${r.url} · ${r.language || '?'} · topics: ${(r.topics || []).slice(0, 8).join(', ') || '-'}`);
    if (r.tree) console.log(`- Code: ${r.tree.codeFiles} code files (${r.tree.codeKB} KB), ${r.tree.testFiles} test, ${r.tree.exampleFiles} example, README ${r.tree.readmeKB} KB, CI workflows ${r.tree.ciWorkflows}${r.tree.truncated ? ' (tree truncated)' : ''}`);
    if (r.tree?.manifests?.length) console.log(`- Manifests: ${r.tree.manifests.join(', ')}`);
    if (r.releases) console.log(`- Releases: ${r.releases.count} total, latest ${r.releases.latestTag || '-'} (${day(r.releases.latest)})`);
    if (r.issues365d) console.log(`- Issues (365d): ${r.issues365d.opened} opened; of ${r.issues365d.sample} sampled, ${pct(r.issues365d.closedShareOfSample)} closed, median ${r.issues365d.medianDaysToClose ?? '-'}d to close; open issues+PRs now ${r.openIssuesAndPRs}`);
    console.log(`- Engagement: ${r.engagement.starsPerDay} stars/day since creation, ${r.engagement.forksPer100Stars} forks per 100 stars, ${r.engagement.watchersPer1kStars} watchers per 1k stars`);
    if (r.signals.good.length) console.log(`- [+] ${r.signals.good.join('; ')}`);
    if (r.signals.warn.length) console.log(`- [!] ${r.signals.warn.join('; ')}`);
    if (r.errors?.length) console.log(`- (unavailable: ${r.errors.join('; ')})`);
  }
  console.log(`\nSignals are leads to verify, not verdicts. Saved: ${file}`);
}

// ---------- pkg ----------

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'oss-scout (agent skill)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 429 ? ' rate limited, retry later' : ''}`);
  return res.json();
}

async function cmdPkg(a) {
  const rows = [];
  for (const spec of a._) {
    const i = spec.indexOf(':');
    const eco = spec.slice(0, i), name = spec.slice(i + 1);
    try {
      if (eco === 'npm') {
        const j = await getJson(`https://api.npmjs.org/downloads/point/last-month/${name}`);
        rows.push([spec, j.downloads, 'last month']);
      } else if (eco === 'pypi') {
        const j = await getJson(`https://pypistats.org/api/packages/${name.toLowerCase()}/recent`);
        rows.push([spec, j.data?.last_month ?? 'not found', 'last month']);
      } else if (eco === 'crates') {
        const j = await getJson(`https://crates.io/api/v1/crates/${name}`);
        rows.push([spec, j.crate?.recent_downloads ?? 'not found', 'last 90 days']);
      } else rows.push([spec, 'unsupported ecosystem (use npm:, pypi:, crates:)', '']);
    } catch (e) { rows.push([spec, `error: ${e.message}`, '']); }
  }
  console.log(mdTable(['package', 'downloads', 'window'], rows));
}

// ---------- clone ----------

function cloneDir(full) { return path.join(HOME, 'repos', full.replace('/', '__')); }

function cmdClone(a) {
  const repos = a._.map(parseRepo);
  if (!repos.length) die('clone needs at least one owner/repo');
  const env = { ...process.env, GIT_LFS_SKIP_SMUDGE: '1', GIT_TERMINAL_PROMPT: '0' };
  const rows = [];
  for (const full of repos) {
    const dest = cloneDir(full);
    if (fs.existsSync(dest) && !a.f.refresh) { fs.utimesSync(dest, new Date(), new Date()); rows.push([full, 'cached', dest]); continue; }
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // Blobless shallow clone; no submodules, no LFS smudge, no symlinks. Git never runs hooks from a clone.
    const r = run('git', ['-c', 'protocol.file.allow=never', '-c', 'core.symlinks=false', '-c', 'core.longpaths=true', 'clone', '--template=', '--depth=1', '--filter=blob:none', '--single-branch', '--no-tags', `https://github.com/${full}.git`, dest], { env });
    rows.push([full, r.ok ? 'cloned' : `FAILED ${trunc(r.stderr.trim().split(/\r?\n/).pop(), 200)}`, dest]);
  }
  console.log(mdTable(['repo', 'status', 'path'], rows));
  console.log('\nCloned code is untrusted: read it, do not install, build, test or run it.');
}

// ---------- probe ----------

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'vendor', 'third_party', '.git', 'Library', 'obj', 'bin', '__pycache__', '.venv', 'venv']);
const SKIP_FILES = /\.(min\.js|map|lock|png|jpe?g|gif|webp|ico|mp4|mov|mp3|wav|zip|gz|7z|tar|pdf|dll|exe|so|dylib|a|o|class|jar|woff2?|ttf|otf|bin|dat|unity3d|asset|fbx|psd)$|^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i;
const HAS_RG = run('rg', ['--version']).ok;

function listFiles(dir) {
  if (HAS_RG) {
    const globs = [...SKIP_DIRS].flatMap((d) => ['-g', `!${d}/`]);
    return run('rg', ['--files', '--path-separator', '/', ...globs], { cwd: dir }).stdout.split(/\r?\n/).filter((f) => f && !SKIP_FILES.test(path.basename(f)));
  }
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p); }
      else if (e.isFile() && !SKIP_FILES.test(e.name)) out.push(p);
    }
  };
  walk('');
  return out;
}

// First matching line per file, case-insensitive literal match.
function findTerm(dir, files, term) {
  const hits = [];
  if (HAS_RG) {
    const globs = [...SKIP_DIRS].flatMap((d) => ['-g', `!${d}/`]);
    const r = run('rg', ['-i', '-F', '-n', '-m', '1', '--no-heading', '--color', 'never', '--path-separator', '/', ...globs, '--', term, '.'], { cwd: dir });
    for (const line of r.stdout.split(/\r?\n/)) {
      const m = /^\.\/(.+?):(\d+):(.*)$/.exec(line);
      if (m && !SKIP_FILES.test(path.basename(m[1]))) hits.push({ path: m[1], line: Number(m[2]), text: m[3] });
    }
    return hits;
  }
  const needle = term.toLowerCase();
  for (const f of files) {
    let buf;
    try { const st = fs.statSync(path.join(dir, f)); if (st.size > 2 * 1024 * 1024) continue; buf = fs.readFileSync(path.join(dir, f)); } catch { continue; }
    if (buf.subarray(0, 4096).includes(0)) continue; // binary
    const text = buf.toString('utf8');
    const idx = text.toLowerCase().indexOf(needle);
    if (idx < 0) continue;
    const lineNo = text.slice(0, idx).split('\n').length;
    hits.push({ path: f, line: lineNo, text: text.split('\n')[lineNo - 1] });
  }
  return hits;
}

function cmdProbe(a) {
  const target = a._[0];
  if (!target) die('probe needs a path or owner/repo');
  const dir = fs.existsSync(target) ? path.resolve(target) : cloneDir(parseRepo(target));
  if (!fs.existsSync(dir)) die(`not found: ${dir} (clone it first)`);
  const terms = String(a.f.terms || '').split(',').map((t) => t.trim()).filter(Boolean);

  const files = listFiles(dir);
  const cats = {}, exts = {}, tops = {};
  for (const f of files) {
    const c = classify(f);
    cats[c] = (cats[c] || 0) + 1;
    if (c === 'code') { const e = path.extname(f).toLowerCase(); exts[e] = (exts[e] || 0) + 1; }
    const top = f.includes('/') ? f.split('/')[0] + '/' : '(root)';
    tops[top] = (tops[top] || 0) + 1;
  }
  const overview = {
    dir, files: files.length, categories: cats, searchBackend: HAS_RG ? 'rg' : 'built-in',
    codeExtensions: Object.entries(exts).sort((x, y) => y[1] - x[1]).slice(0, 8),
    topDirs: Object.entries(tops).sort((x, y) => y[1] - x[1]).slice(0, 12),
    manifests: files.filter((f) => MANIFESTS.test(f) && f.split('/').length <= 3).slice(0, 20),
    entryHints: entryHints(dir),
  };

  const results = terms.map((term) => {
    const hits = { code: [], test: [], example: [], doc: [], other: [] };
    for (const h of findTerm(dir, files, term)) {
      const c = classify(h.path);
      if (c !== 'vendor') hits[c].push({ ...h, text: trunc(h.text, 120) });
    }
    const verdict = hits.code.length ? (hits.test.length ? 'code + tests' : 'code, no tests') : hits.example.length ? 'examples only' : hits.doc.length ? 'DOCS ONLY' : hits.other.length ? 'config/other only' : 'absent';
    return { term, verdict, counts: Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v.length])), samples: [...hits.code.slice(0, 3), ...hits.test.slice(0, 1), ...(hits.code.length ? [] : [...hits.example.slice(0, 1), ...hits.doc.slice(0, 2)])] };
  });
  if (a.f.json) return console.log(JSON.stringify({ overview, results }, null, 2));

  console.log(`## ${dir}\n`);
  console.log(`- Files: ${overview.files} (${Object.entries(cats).map(([k, v]) => `${k} ${v}`).join(', ')}); search: ${overview.searchBackend}`);
  console.log(`- Code types: ${overview.codeExtensions.map(([e, n]) => `${e} ${n}`).join(', ') || '-'}`);
  console.log(`- Top dirs: ${overview.topDirs.map(([d, n]) => `${d} ${n}`).join(', ')}`);
  console.log(`- Manifests: ${overview.manifests.join(', ') || '-'}`);
  if (overview.entryHints.length) console.log(`- Entry hints: ${overview.entryHints.join('; ')}`);
  if (results.length) {
    console.log('\n## Proof terms\n');
    console.log(mdTable(['term', 'verdict', 'code', 'tests', 'examples', 'docs'], results.map((x) => [x.term, x.verdict, x.counts.code, x.counts.test, x.counts.example, x.counts.doc])));
    for (const x of results) {
      if (!x.samples.length) continue;
      console.log(`\n**${x.term}**`);
      for (const s of x.samples) console.log(`- ${s.path}:${s.line}  ${s.text}`);
    }
  }
}

function entryHints(dir) {
  const hints = [];
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return null; } };
  const pkg = read('package.json');
  if (pkg) {
    try {
      const j = JSON.parse(pkg);
      if (j.main) hints.push(`package.json main=${j.main}`);
      if (j.bin) hints.push(`bin=${typeof j.bin === 'string' ? j.bin : Object.keys(j.bin).join(',')}`);
      if (j.exports) hints.push('package.json exports');
      if (j.scripts) hints.push(`scripts: ${Object.keys(j.scripts).slice(0, 8).join(',')}`);
      if (j.unity) hints.push(`Unity package (unity ${j.unity})`);
    } catch { /* malformed package.json */ }
  }
  const py = read('pyproject.toml');
  if (py) { const m = py.match(/\[project\.scripts\]([\s\S]*?)(\n\[|$)/); if (m) hints.push(`pyproject scripts: ${m[1].trim().split(/\r?\n/).map((l) => l.split('=')[0].trim()).join(',')}`); }
  const cargo = read('Cargo.toml');
  if (cargo && /\[\[bin\]\]/.test(cargo)) hints.push('Cargo [[bin]] targets');
  const unityVer = read('ProjectSettings/ProjectVersion.txt');
  if (unityVer) hints.push(`Unity project ${(unityVer.match(/m_EditorVersion:\s*(\S+)/) || [])[1] || ''}`.trim());
  return hints;
}

// ---------- clean ----------

function cmdClean(a) {
  const days = Number(a.f['older-than'] ?? 30);
  const root = path.join(HOME, 'repos');
  if (!fs.existsSync(root)) return console.log('nothing cached');
  let n = 0;
  for (const d of fs.readdirSync(root)) {
    const p = path.join(root, d);
    if ((NOW - fs.statSync(p).mtimeMs) / DAY > days) { fs.rmSync(p, { recursive: true, force: true }); n++; }
  }
  console.log(`removed ${n} cached clone(s) older than ${days}d`);
}

// ---------- main ----------

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
switch (cmd) {
  case 'check': await cmdCheck(); break;
  case 'search': await cmdSearch(args); break;
  case 'inspect': await cmdInspect(args); break;
  case 'pkg': await cmdPkg(args); break;
  case 'clone': cmdClone(args); break;
  case 'probe': cmdProbe(args); break;
  case 'clean': cmdClean(args); break;
  default: console.log(HELP);
}
