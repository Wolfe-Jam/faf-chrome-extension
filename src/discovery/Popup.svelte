<script lang="ts">
  import { onMount } from 'svelte';
  import { type DiscoveryReport, type DiscoveryRow, type RowStatus, issues, parseGithubRepo } from '@/core/discovery';
  import { chromeScripting, discoverTab } from './run';

  type View = { kind: 'loading' } | { kind: 'error'; reason: string; retry?: false } | { kind: 'done'; report: DiscoveryReport };

  const MARK: Record<RowStatus, string> = { found: '✓', missing: '✗', unreadable: '!', skipped: '–' };
  const LABEL: Record<RowStatus, string> = {
    found: 'Published',
    missing: 'Not published',
    unreadable: 'Unreadable',
    skipped: 'Skipped',
  };

  let view = $state<View>({ kind: 'loading' });
  const BYLINE = 'By James Wolfe, .FAF Creator and AAIF Ambassador';

  /** The pill: "Published", or "Published · 1 MUST · 2 SHOULD" when spec checks failed. */
  function pill(row: DiscoveryRow): { text: string; warn: boolean } {
    const n = issues(row);
    if (row.status !== 'found' || n.must + n.should === 0) return { text: LABEL[row.status], warn: false };
    const parts = [n.must && `${n.must} MUST`, n.should && `${n.should} SHOULD`].filter(Boolean);
    return { text: [LABEL.found, ...parts].join(' · '), warn: n.must > 0 };
  }

  /** 586 ms; 4.6 s from a second up. */
  function took(ms: number): string {
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
  }

  /** On a GitHub repo page, the repo's own rows get a heading so they don't read as github.com's. */
  function repoName(report: DiscoveryReport): string | null {
    const gh = parseGithubRepo(report.pageUrl);
    return gh ? `${gh.owner}/${gh.repo}` : null;
  }

  /** Failed first (MUST before SHOULD), then passed, then skipped. */
  function ordered(row: DiscoveryRow) {
    const rank = (c: NonNullable<DiscoveryRow['checks']>[number]) =>
      (c.status === 'fail' ? 0 : c.status === 'pass' ? 2 : c.status === 'skip' ? 3 : 4) +
      (c.level === 'must' ? 0 : 1);
    return [...(row.checks ?? [])].sort((a, b) => rank(a) - rank(b));
  }

  const CHECK_MARK = { pass: '✓', fail: '✗', skip: '–', info: 'i' } as const;

  async function run() {
    view = { kind: 'loading' };
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const out = await discoverTab(tab ?? {}, chromeScripting);
      view = out.ok ? { kind: 'done', report: out.report } : { kind: 'error', reason: out.reason, retry: out.retry };
    } catch (e) {
      view = { kind: 'error', reason: e instanceof Error ? e.message : String(e) };
    }
  }

  onMount(run);
</script>

<main>
  <header>
    <h1>Agent Discovery Check</h1>
    {#if view.kind === 'done'}
      <p class="site">{new URL(view.report.origin).host}</p>
    {/if}
  </header>

  {#if view.kind === 'loading'}
    <p class="note" role="status">Checking this site…</p>
  {:else if view.kind === 'error'}
    <p class="note" role="alert">{view.reason}</p>
    {#if view.retry !== false}
      <button type="button" onclick={run}>Try again</button>
    {/if}
  {:else}
    <ul>
      {#each view.report.rows as row (row.id)}
        {#if row.id === 'agents-md' && repoName(view.report)}
          <li class="group">{repoName(view.report)}</li>
        {/if}
        <li class={row.status}>
          <span class="mark" aria-hidden="true">{MARK[row.status]}</span>
          <div class="body">
            <div class="line">
              <span class="title">{row.title}</span>
              <span class="status" class:warn={pill(row).warn}>{pill(row).text}</span>
            </div>
            {#if row.detail}<p class="detail">{row.detail}</p>{/if}
            {#if row.checks?.length}
              <details class="checks">
                <summary>{row.checks.filter((c) => c.level !== 'note').length} spec checks{#if row.checks.some((c) => c.level === 'note')}, with notes{/if}</summary>
                <ul>
                  {#each ordered(row) as c, i (`${i}:${c.id}`)}
                    <li class={`check ${c.status}`}>
                      <span class="cmark" aria-hidden="true">{CHECK_MARK[c.status]}</span>
                      <span class="level">{c.level.toUpperCase()}</span>
                      <span class="ctitle">
                        {c.title}
                        {#if c.detail && c.status !== 'pass'}<span class="cdetail">{c.detail}</span>{/if}
                      </span>
                      {#if c.spec}<a href={c.spec.url} target="_blank" rel="noreferrer" title={c.spec.label}>↗</a>{/if}
                    </li>
                  {/each}
                </ul>
              </details>
            {/if}
            <a href={row.spec.url} target="_blank" rel="noreferrer" title={row.spec.label} aria-label={`${row.spec.label} spec`}>Spec ↗</a>
          </div>
        </li>
      {/each}
    </ul>
    <div class="bottom">
      <div class="actions">
        <span class="timing">{took(view.report.ms)}</span>
        <button type="button" onclick={run}>Check again</button>
      </div>
      <footer>{BYLINE}</footer>
    </div>
  {/if}

  {#if view.kind !== 'done'}
    <footer>{BYLINE}</footer>
  {/if}
</main>

<style>
  :global(:root) {
    --bg: #ffffff;
    --fg: #14181f;
    --muted: #5b6573;
    --line: #e1e5ea;
    --found: #00bc61;
    /* Foundation Green carries dark text, never white (contrast). */
    --found-ink: #062612;
    --missing: #8a93a0;
    --unreadable: #b7791f;
    --link: #0b6e99;
    color-scheme: light dark;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --bg: #14181f;
      --fg: #e8ecf1;
      --muted: #9aa5b4;
      --line: #2a313c;
      --missing: #6f7886;
      --unreadable: #e0a84a;
      --link: #4cb8e0;
    }
  }

  :global(body) {
    margin: 0;
    width: 360px;
    background: var(--bg);
    color: var(--fg);
    font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
  }

  main {
    padding: 14px 16px 12px;
  }

  h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
  }

  .site {
    margin: 2px 0 10px;
    color: var(--muted);
    word-break: break-all;
  }

  header {
    margin-bottom: 4px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: flex;
    gap: 10px;
    padding: 9px 0 9px 10px;
    border-top: 1px solid var(--line);
    border-left: 3px solid var(--missing);
  }

  li.found {
    border-left-color: var(--found);
  }

  li.unreadable {
    border-left-color: var(--unreadable);
  }

  li.skipped {
    border-left-color: var(--line);
  }

  .mark {
    width: 14px;
    flex: none;
    text-align: center;
    font-weight: 700;
  }

  li.found .mark {
    color: var(--found);
  }

  li.unreadable .mark {
    color: var(--unreadable);
  }

  .body {
    min-width: 0;
    flex: 1;
  }

  .line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .title {
    font-weight: 600;
  }

  .status {
    flex: none;
    align-self: flex-start;
    padding: 1px 8px;
    border: 1px solid var(--missing);
    border-radius: 999px;
    color: var(--muted);
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.5;
  }

  li.found .status {
    border-color: var(--found);
    background: var(--found);
    color: var(--found-ink);
  }

  li.unreadable .status {
    border-color: var(--unreadable);
    color: var(--fg);
  }

  li.found .status.warn {
    border-color: var(--unreadable);
    background: transparent;
    color: var(--fg);
  }

  .checks {
    margin: 4px 0 2px;
  }

  .checks summary {
    cursor: pointer;
    color: var(--muted);
    font-size: 12px;
  }

  .checks ul {
    margin-top: 4px;
  }

  li.check {
    display: flex;
    gap: 6px;
    align-items: baseline;
    padding: 3px 0;
    border: 0;
    font-size: 12px;
  }

  .cmark {
    width: 12px;
    flex: none;
    font-weight: 700;
  }

  li.check.pass .cmark {
    color: var(--found);
  }

  li.check.fail .cmark {
    color: var(--unreadable);
  }

  li.check.skip,
  li.check.info {
    color: var(--muted);
  }

  li.check.info .cmark {
    font-style: italic;
  }

  .level {
    flex: none;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--muted);
  }

  .ctitle {
    flex: 1;
    min-width: 0;
  }

  .cdetail {
    display: block;
    color: var(--muted);
    word-break: break-word;
  }

  li.skipped .status {
    border-color: transparent;
    padding-inline: 0;
    font-weight: 400;
  }

  .detail {
    margin: 1px 0 0;
    color: var(--muted);
    word-break: break-word;
  }

  a {
    color: var(--link);
    font-size: 12px;
  }

  li.group {
    display: block;
    padding: 12px 0 4px;
    border-left: 0;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    word-break: break-all;
  }

  /* Timing, Check again and the byline stay in view when the results scroll. */
  .bottom {
    position: sticky;
    bottom: 0;
    background: var(--bg);
    padding-bottom: 2px;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }

  .timing {
    color: var(--muted);
  }

  button {
    font: inherit;
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: transparent;
    color: var(--fg);
    cursor: pointer;
  }

  button:hover {
    border-color: var(--link);
  }

  .note {
    margin: 8px 0 10px;
    color: var(--muted);
  }

  footer {
    margin-top: 12px;
    color: var(--muted);
    font-size: 11px;
  }
</style>
