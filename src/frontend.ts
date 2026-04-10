// frontend.ts — dashboard HTML/CSS/JS (no imports needed at runtime)

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --border: #2a2d3a;
    --text: #e2e8f0;
    --muted: #718096;
    --ok: #48bb78;
    --warn: #ed8936;
    --err: #fc8181;
    --modrinth: #1bd96a;
    --curseforge: #f16436;
    --fabric: #dbb884;
    --maven: #4a9eff;
    --unknown: #718096;
  }
  body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; line-height: 1.6; }
  /* Header */
  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: .75rem 2rem; display: flex; align-items: center; gap: 1rem; }
  header h1 { font-size: 1.25rem; font-weight: 600; flex: 1; }
  .header-actions { display: flex; align-items: center; gap: .6rem; }
  .token-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
  body.authed .token-dot { background: var(--ok); }
  /* Main */
  main { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1rem; }
  section { margin-bottom: 2rem; }
  h2 { font-size: 1rem; font-weight: 600; margin-bottom: .75rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  /* Repo list */
  .repo-grid { display: flex; flex-wrap: wrap; gap: .5rem; }
  .repo-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: .4rem .8rem; display: flex; align-items: center; gap: .5rem; cursor: pointer; transition: border-color .15s; }
  .repo-card:hover, .repo-card.active { border-color: var(--maven); }
  .repo-card .rm-btn { color: var(--err); border: none; background: none; cursor: pointer; font-size: .85rem; padding: 0 .2rem; display: none; }
  .repo-card .rm-btn:hover { opacity: .7; }
  body.authed .repo-card .rm-btn { display: inline; }
  /* Buttons */
  button { background: var(--maven); color: #fff; border: none; border-radius: 6px; padding: .4rem .9rem; cursor: pointer; font-size: .9rem; }
  button:hover { opacity: .85; }
  button.secondary { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
  button.secondary:hover { border-color: var(--text); }
  button.icon-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: .35rem .7rem; font-size: .85rem; }
  button.icon-btn:hover { border-color: var(--maven); color: var(--maven); }
  /* Results */
  .results-header { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; margin-bottom: .75rem; }
  .results-header h2 { margin: 0; }
  .repo-label { color: var(--text); font-weight: 600; font-size: 1rem; }
  .ctx-badge { font-size: .8rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: .15rem .55rem; color: var(--muted); }
  .ctx-badge.loader-fabric   { color: var(--fabric);     border-color: var(--fabric);     background: #3d2e1020; }
  .ctx-badge.loader-neoforge { color: #c8a06a;           border-color: #c8a06a;           background: #3d2e1020; }
  .ctx-badge.loader-forge    { color: #c8a06a;           border-color: #c8a06a;           background: #3d2e1020; }
  .ctx-badge.loader-quilt    { color: #b08de8;           border-color: #b08de8;           background: #2a1f4020; }
  /* Table */
  table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: 8px; overflow: hidden; }
  thead th { padding: .5rem 1rem; text-align: left; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); border-bottom: 1px solid var(--border); }
  td { padding: .5rem 1rem; border-bottom: 1px solid var(--border); font-size: .9rem; }
  tr:last-child td { border: none; }
  tr.row-outdated td:first-child { border-left: 3px solid var(--warn); }
  tr.row-ok td:first-child { border-left: 3px solid transparent; }
  /* Group header rows */
  tr.group-header td { background: #14172240; font-weight: 600; color: var(--text); border-top: 1px solid var(--border); }
  tr.group-header:first-child td { border-top: none; }
  tr.group-header.group-outdated td:first-child { border-left: 3px solid var(--warn); }
  tr.group-header.group-ok td:first-child { border-left: 3px solid transparent; }
  tr.variant-row td:first-child { padding-left: 2rem; color: var(--muted); }
  tr.variant-row.row-outdated td:first-child { border-left: 3px solid var(--warn); color: var(--text); }
  .center { text-align: center; }
  .status { font-weight: 500; }
  .status-ok { color: var(--ok); }
  .status-outdated { color: var(--warn); }
  .status-unknown { color: var(--muted); }
  /* Badges */
  .badge { font-size: .75rem; padding: .1rem .45rem; border-radius: 4px; font-weight: 600; }
  .badge-modrinth   { background: #0a3d20; color: var(--modrinth); }
  .badge-curseforge { background: #3d1a0a; color: var(--curseforge); }
  .badge-forge      { background: #2a1a0a; color: #c8a06a; }
  .badge-neoforge   { background: #2a1a0a; color: #e8b87a; }
  .badge-fabric     { background: #3d2e10; color: var(--fabric); }
  .badge-maven      { background: #0a2040; color: var(--maven); }
  .badge-unknown    { background: #1a1d27; color: var(--unknown); border: 1px solid var(--border); }
  /* Overrides editor */
  .msg { font-size: .85rem; color: var(--muted); }
  .msg.err { color: var(--err); }
  .msg.ok { color: var(--ok); }
  .empty { color: var(--muted); padding: 1rem 0; }
  #loading { color: var(--muted); font-style: italic; }
  .loading-progress { font-size: .85rem; margin-top: .25rem; color: var(--muted); }
  .progress-bar { height: 3px; background: var(--border); border-radius: 2px; margin-top: .4rem; overflow: hidden; }
  .progress-bar-fill { height: 100%; background: var(--maven); border-radius: 2px; transition: width .2s; }
  .progress-dep { color: var(--muted); font-family: monospace; font-size: .85em; }
  /* Copyable version chip */
  .v-copy { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: .05rem .35rem; font-family: monospace; font-size: .85em; cursor: pointer; user-select: all; transition: border-color .15s; }
  .v-copy:hover { border-color: var(--maven); color: var(--maven); }
  .v-copy.copied { border-color: var(--ok); color: var(--ok); }
  /* Filter chips */
  .filter-chips { display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: .75rem; }
  .chip { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: .15rem .6rem; font-size: .8rem; cursor: pointer; color: var(--muted); transition: border-color .15s, color .15s; }
  .chip:hover { border-color: var(--text); color: var(--text); }
  .chip.active { border-color: var(--maven); color: var(--maven); background: #0a204020; }
  /* Declared-in link */
  .decl-link { font-size: .8rem; color: var(--muted); text-decoration: none; }
  .decl-link:hover { color: var(--maven); text-decoration: underline; }
  /* Set Repo button */
  .set-repo-btn { font-size: .75rem; padding: .1rem .4rem; background: none; border: 1px solid var(--border); color: var(--muted); border-radius: 4px; cursor: pointer; }
  .set-repo-btn:hover { border-color: var(--maven); color: var(--maven); opacity: 1; }
  /* Dialog */
  dialog { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 0; width: min(420px, 90vw); box-shadow: 0 8px 40px #00000080; position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); margin: 0; }
  dialog::backdrop { background: #00000080; }
  .dlg-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem .75rem; border-bottom: 1px solid var(--border); }
  .dlg-header h3 { font-size: 1rem; font-weight: 600; }
  .dlg-close { background: none; border: none; color: var(--muted); font-size: 1.2rem; padding: 0 .25rem; cursor: pointer; }
  .dlg-close:hover { color: var(--text); opacity: 1; }
  .dlg-body { padding: 1rem 1.25rem 1.25rem; display: flex; flex-direction: column; gap: .75rem; }
  .dlg-field { display: flex; flex-direction: column; gap: .3rem; }
  .dlg-field label { font-size: .85rem; color: var(--muted); }
  .dlg-field input { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: .4rem .75rem; font-size: .95rem; }
  .dlg-field input::placeholder { color: var(--muted); }
  .dlg-field input:focus { outline: 2px solid var(--maven); border-color: transparent; }
  .dlg-actions { display: flex; gap: .5rem; justify-content: flex-end; }
  .dlg-hint { font-size: .8rem; color: var(--muted); }
`

// ---------------------------------------------------------------------------
// JavaScript (runs in browser)
// ---------------------------------------------------------------------------

const JS = `
const API = ''

let token = localStorage.getItem('mvd_token') || ''
// Array of { owner, repo, status: 'loading'|'ok'|'error', data, error }
let allRepoResults = []
let _filterRepo  = null   // 'owner/repo' string or null
let _filterSource = null  // source string or null

// ── Dialog helpers ──────────────────────────────────────────────────────────
function openDialog(id) {
  const dlg = document.getElementById(id)
  dlg.showModal()
  dlg.addEventListener('click', function onBdClick(e) {
    if (e.target === dlg) { dlg.close(); dlg.removeEventListener('click', onBdClick) }
  }, { once: false })
}

// ── Auth ────────────────────────────────────────────────────────────────────
function applyAuth() {
  const input = document.getElementById('dlg-token-input')
  token = input.value.trim()
  localStorage.setItem('mvd_token', token)
  document.body.classList.toggle('authed', !!token)
  document.getElementById('dlg-token-status').textContent = token ? 'Token saved.' : 'Token cleared.'
}

function initAuth() {
  const input = document.getElementById('dlg-token-input')
  input.value = token
  if (token) document.body.classList.add('authed')
}

function authHeaders() {
  return token ? { 'Authorization': 'Bearer ' + token } : {}
}

// ── Repo list ───────────────────────────────────────────────────────────────
async function loadRepos() {
  const res = await fetch(API + '/api/repos')
  const repos = await res.json()
  // Pre-select repo from URL if present
  const urlRepo = new URLSearchParams(location.search).get('repo')
  if (urlRepo && !_filterRepo) _filterRepo = urlRepo
  renderRepos(repos)
  // Reset results state and kick off parallel checks for all repos
  allRepoResults = repos.map(r => ({ owner: r.owner, repo: r.repo, status: 'loading', data: null, error: null }))
  renderAll()
  repos.forEach(({ owner, repo }) => checkRepo(owner, repo))
}

function renderRepos(repos) {
  const grid = document.getElementById('repo-grid')
  grid.innerHTML = ''
  if (!repos.length) {
    grid.innerHTML = '<span style="color:var(--muted);font-size:.9rem">No repos yet — click + Add Repo</span>'
    return
  }
  for (const { owner, repo } of repos) {
    const card = document.createElement('div')
    card.className = 'repo-card'
    card.dataset.key = owner + '/' + repo
    card.innerHTML = \`<span>\${esc(owner)}/<strong>\${esc(repo)}</strong></span>
      <button class="rm-btn" title="Remove" onclick="removeRepo('\${esc(owner)}', '\${esc(repo)}', event)">✕</button>\`
    card.addEventListener('click', e => { if (!e.target.classList.contains('rm-btn')) selectRepo(owner, repo, card) })
    grid.appendChild(card)
    if (_filterRepo === owner + '/' + repo) card.classList.add('active')
  }
}

function selectRepo(owner, repo, card) {
  const key = owner + '/' + repo
  _filterSource = null
  if (_filterRepo === key) {
    // Deselect → show all
    _filterRepo = null
    history.replaceState(null, '', location.pathname)
    document.querySelectorAll('.repo-card').forEach(c => c.classList.remove('active'))
  } else {
    _filterRepo = key
    history.replaceState(null, '', location.pathname + '?repo=' + encodeURIComponent(key))
    document.querySelectorAll('.repo-card').forEach(c => c.classList.remove('active'))
    card.classList.add('active')
  }
  renderAll()
}

async function addRepo() {
  const owner = document.getElementById('dlg-add-owner').value.trim()
  const repo  = document.getElementById('dlg-add-repo').value.trim()
  if (!owner || !repo) return
  const res = await fetch(API + '/api/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ owner, repo }),
  })
  if (res.ok) {
    document.getElementById('dlg-add-owner').value = ''
    document.getElementById('dlg-add-repo').value = ''
    document.getElementById('dlg-add').close()
    // Add new repo slot and start checking it
    allRepoResults.push({ owner, repo, status: 'loading', data: null, error: null })
    renderAll()
    checkRepo(owner, repo)
    loadRepos()
  } else {
    document.getElementById('dlg-add-err').textContent = await res.text()
  }
}

async function removeRepo(owner, repo, e) {
  e.stopPropagation()
  if (!confirm('Remove ' + owner + '/' + repo + '?')) return
  await fetch(API + \`/api/repos/\${encodeURIComponent(owner)}/\${encodeURIComponent(repo)}\`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  allRepoResults = allRepoResults.filter(r => !(r.owner === owner && r.repo === repo))
  if (_filterRepo === owner + '/' + repo) _filterRepo = null
  renderAll()
  loadRepos()
}

// ── Per-repo version check (SSE streaming) ───────────────────────────────────
function groupDepsJS(deps) {
  const map = new Map()
  for (const dep of deps) {
    const arr = map.get(dep.logicalName) ?? []
    arr.push(dep)
    map.set(dep.logicalName, arr)
  }
  const groups = []
  for (const [logicalName, variants] of map) {
    variants.sort((a, b) => a.name.localeCompare(b.name))
    groups.push({
      logicalName,
      source: variants[0].source,
      variants,
      anyOutdated: variants.some(v => v.upToDate === false),
    })
  }
  const LOADER_SOURCES = new Set(['forge', 'neoforge', 'fabric'])
  groups.sort((a, b) => {
    const aLoader = LOADER_SOURCES.has(a.source)
    const bLoader = LOADER_SOURCES.has(b.source)
    if (aLoader !== bLoader) return aLoader ? -1 : 1
    if (a.anyOutdated !== b.anyOutdated) return a.anyOutdated ? -1 : 1
    return a.logicalName.localeCompare(b.logicalName)
  })
  return groups
}

async function checkRepo(owner, repo) {
  const slot = allRepoResults.find(r => r.owner === owner && r.repo === repo)
  if (!slot) return
  slot.receivedDeps = []
  slot.total = null
  slot.checking = null

  return new Promise(resolve => {
    let tokenParam = token ? '&token=' + encodeURIComponent(token) : ''
    const url = \`\${API}/api/stream?owner=\${encodeURIComponent(owner)}&repo=\${encodeURIComponent(repo)}\${tokenParam}\`
    const es = new EventSource(url)

    let rafId = null
    function scheduleRender() {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => { rafId = null; renderAll() })
    }

    es.addEventListener('context', e => {
      const { context, total } = JSON.parse(e.data)
      slot.context = context
      slot.total = total
      slot.data = { context, groups: [] }
      scheduleRender()
    })

    es.addEventListener('checking', e => {
      slot.checking = JSON.parse(e.data).name
      scheduleRender()
    })

    es.addEventListener('dep', e => {
      const dep = JSON.parse(e.data)
      slot.receivedDeps.push(dep)
      slot.checking = null
      slot.data = { context: slot.context, groups: groupDepsJS(slot.receivedDeps) }
      scheduleRender()
    })

    es.addEventListener('done', () => {
      es.close()
      slot.status = 'ok'
      if (slot.data) slot.data = { context: slot.context, groups: groupDepsJS(slot.receivedDeps) }
      scheduleRender()
      resolve()
    })

    es.addEventListener('error', ev => {
      // SSE fires 'error' on connection close too; only treat as failure if still loading
      if (slot.status === 'loading') {
        es.close()
        slot.status = 'error'
        slot.error = 'Stream connection failed'
        scheduleRender()
        resolve()
      }
    })
  })
}

// ── Render all (with optional repo + source filter) ──────────────────────────
function renderAll() {
  const resultsEl = document.getElementById('results')

  const repoResults = _filterRepo
    ? allRepoResults.filter(r => r.owner + '/' + r.repo === _filterRepo)
    : allRepoResults

  const loading  = repoResults.filter(r => r.status === 'loading')
  const errors   = repoResults.filter(r => r.status === 'error')
  const ready    = repoResults.filter(r => r.status === 'ok' && r.data)
  // Include loading repos that have received at least one dep so their partial results are shown
  const withData = repoResults.filter(r => r.data)

  // Header label + context badges
  const labelEl = document.getElementById('results-repo-label')
  labelEl.textContent = _filterRepo ? _filterRepo : (allRepoResults.length ? 'All Repos' : '')
  const ctxEl = document.getElementById('results-ctx')
  const ctxSource = withData.length === 1 ? withData[0] : (ready.length === 1 ? ready[0] : null)
  ctxEl.innerHTML = (_filterRepo && ctxSource) ? renderContextBadges(ctxSource.data.context) : ''

  // Merge all groups (including partial from still-loading repos); tag with source repo
  const allGroups = withData.flatMap(r =>
    r.data.groups.map(g => Object.assign({}, g, { _owner: r.owner, _repo: r.repo }))
  )

  // Source filter chips
  const sourcesPresent = [...new Set(allGroups.map(g => g.source))]
  const chipsHtml = sourcesPresent.length ? \`<div class="filter-chips">\${
    sourcesPresent.map(src => {
      const active = _filterSource === src ? ' active' : ''
      const label = { modrinth:'Modrinth', curseforge:'CurseForge', fabric:'Fabric', forge:'Forge', neoforge:'NeoForge', maven:'Maven' }[src] || 'Unknown'
      const count = allGroups.filter(g => g.source === src).length
      return \`<button class="chip\${active}" onclick="setFilterSource('\${esc(src)}')">\${esc(label)} (\${count})</button>\`
    }).join('')
  }</div>\` : ''

  const loadingHtml = loading.length
    ? loading.map(r => {
        const s = allRepoResults.find(x => x.owner === r.owner && x.repo === r.repo)
        const received = s?.receivedDeps?.length ?? 0
        const total = s?.total ?? null
        const pct = total ? Math.round(received / total * 100) : 0
        const checkingName = s?.checking ? esc(s.checking.replace(/^[^:]+:/, '')) : null
        const label = total !== null
          ? \`Checking \${esc(r.owner + '/' + r.repo)} — \${received} / \${total}\${checkingName ? \` · <span class="progress-dep">\${checkingName}</span>\` : ''}…\`
          : \`Checking \${esc(r.owner + '/' + r.repo)}…\`
        return \`<p id="loading">\${label}</p>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:\${pct}%"></div></div>\`
      }).join('')
    : ''
  const errHtml = errors.map(r =>
    \`<p class="msg err">\${esc(r.owner + '/' + r.repo)}: \${esc(r.error || 'Failed')}</p>\`
  ).join('')

  const filtered = _filterSource ? allGroups.filter(g => g.source === _filterSource) : allGroups

  if (!filtered.length) {
    // If still loading but no deps arrived yet, show progress only; no "empty" message
    resultsEl.innerHTML = loadingHtml + errHtml + (loading.length && !withData.length ? '' : '<p class="empty">No dependencies found.</p>')
    return
  }

  let rows = ''
  for (const g of filtered) {
    const owner = g._owner, repo = g._repo
    if (g.variants.length === 1) {
      const v = g.variants[0]
      rows += \`<tr class="\${v.upToDate === false ? 'row-outdated' : 'row-ok'}">
        <td>\${esc(shortArtifact(v.name))}</td>
        <td>\${badge(g.source)}\${setRepoBtn(v, owner, repo)}</td>
        <td>\${esc(v.currentVersion)}</td>
        \${statusTd(v)}
        <td>\${declaredInCell(v, owner, repo)}</td>
      </tr>\`
    } else {
      const outdatedCount = g.variants.filter(v => v.upToDate === false).length
      const headerStatus = g.anyOutdated
        ? \`<td class="status status-outdated">\${outdatedCount} outdated</td>\`
        : \`<td class="status status-ok">all up to date</td>\`
      rows += \`<tr class="group-header \${g.anyOutdated ? 'group-outdated' : 'group-ok'}">
        <td>\${esc(shortLogical(g.logicalName))}</td>
        <td>\${badge(g.source)}</td>
        <td></td>
        \${headerStatus}
        <td></td>
      </tr>\`
      for (const v of g.variants) {
        rows += \`<tr class="variant-row \${v.upToDate === false ? 'row-outdated' : 'row-ok'}">
          <td>\${esc(variantSuffix(v.name, g.logicalName))}</td>
          <td>\${setRepoBtn(v, owner, repo)}</td>
          <td>\${esc(v.currentVersion)}</td>
          \${statusTd(v)}
          <td>\${declaredInCell(v, owner, repo)}</td>
        </tr>\`
      }
    }
  }

  resultsEl.innerHTML = loadingHtml + errHtml + chipsHtml + \`<table>
    <thead><tr>
      <th>Dependency</th>
      <th>Source</th>
      <th>Current</th>
      <th>Latest / Status</th>
      <th>Declared in</th>
    </tr></thead>
    <tbody>\${rows}</tbody>
  </table>\`
}

function setFilterSource(src) {
  _filterSource = _filterSource === src ? null : src
  renderAll()
}

function renderContextBadges(ctx) {
  if (!ctx) return ''
  const parts = []
  if (ctx.mcVersion) parts.push(\`<span class="ctx-badge">MC \${esc(ctx.mcVersion)}</span>\`)
  for (const l of (ctx.loaders || [])) {
    const v = ctx.loaderVersions?.[l]
    const vStr = v ? \` \${esc(v)}\` : ''
    parts.push(\`<span class="ctx-badge loader-\${esc(l)}">⬡ \${esc(l)}\${vStr}</span>\`)
  }
  return parts.join('')
}

function declaredInCell(v, owner, repo) {
  if (!v.declaredIn) return '<span style="color:var(--muted)">—</span>'
  const { file, line } = v.declaredIn
  const href = \`https://github.com/\${encodeURIComponent(owner)}/\${encodeURIComponent(repo)}/blob/HEAD/\${file}#L\${line}\`
  return \`<a class="decl-link" href="\${esc(href)}" target="_blank" rel="noopener">\${esc(file)}:\${line}</a>\`
}

function setRepoBtn(v, owner, repo) {
  if (v.source !== 'maven' && v.source !== 'unknown') return ''
  return \` <button class="set-repo-btn" onclick="openSetRepo('\${esc(v.name)}','\${esc(owner)}','\${esc(repo)}','\${esc(v.mavenRepo||'')}')">Set Repo</button>\`
}

// ── Set Repo dialog ─────────────────────────────────────────────────────────
function openSetRepo(dep, owner, repo, currentRepoUrl) {
  document.getElementById('dlg-sr-dep').value = dep
  document.getElementById('dlg-sr-owner').value = owner
  document.getElementById('dlg-sr-repo').value = repo
  document.getElementById('dlg-sr-url').value = currentRepoUrl
  document.getElementById('dlg-sr-dep-label').textContent = dep
  document.getElementById('dlg-sr-msg').textContent = ''
  openDialog('dlg-set-repo')
}

async function saveSetRepo() {
  const dep   = document.getElementById('dlg-sr-dep').value
  const owner = document.getElementById('dlg-sr-owner').value
  const repo  = document.getElementById('dlg-sr-repo').value
  const url   = document.getElementById('dlg-sr-url').value.trim()
  if (!url) return
  const res = await fetch(\`\${API}/api/overrides?owner=\${encodeURIComponent(owner)}&repo=\${encodeURIComponent(repo)}\`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ dep, mavenRepo: url }),
  })
  if (res.ok) {
    document.getElementById('dlg-set-repo').close()
    const slot = allRepoResults.find(r => r.owner === owner && r.repo === repo)
    if (slot) { slot.status = 'loading'; slot.data = null; renderAll() }
    checkRepo(owner, repo)
  } else {
    document.getElementById('dlg-sr-msg').textContent = await res.text()
    document.getElementById('dlg-sr-msg').className = 'msg err'
  }
}

function statusTd(v) {
  if (v.upToDate === null) return '<td class="status status-unknown">—</td>'
  const ver = v.latestVersion
    ? \`<code class="v-copy" title="Click to copy" data-ver="\${esc(v.latestVersion)}" onclick="copyVer(this)">\${esc(v.latestVersion)}</code>\`
    : ''
  if (v.upToDate) return \`<td class="status status-ok">✓ \${ver}</td>\`
  return \`<td class="status status-outdated">⚠ \${ver}</td>\`
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function badge(src) {
  const cls = { modrinth:'badge-modrinth', curseforge:'badge-curseforge', fabric:'badge-fabric', forge:'badge-forge', neoforge:'badge-neoforge', maven:'badge-maven' }[src] || 'badge-unknown'
  const lbl = { modrinth:'Modrinth', curseforge:'CurseForge', fabric:'Fabric', forge:'Forge', neoforge:'NeoForge', maven:'Maven' }[src] || 'Unknown'
  return \`<span class="badge \${cls}">\${lbl}</span>\`
}

function shortArtifact(name) {
  // Show full group:artifact Maven coordinates
  return name
}

function copyVer(el) {
  const text = el.dataset.ver
  navigator.clipboard?.writeText(text).then(() => {
    el.classList.add('copied')
    setTimeout(() => el.classList.remove('copied'), 1200)
  }).catch(() => {
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    sel?.removeAllRanges()
    sel?.addRange(range)
  })
}

function shortLogical(logicalName) {
  // Show full group:logicalArtifact coordinates
  return logicalName
}

function variantSuffix(name, logicalName) {
  // For variant sub-rows, show the artifact part only (the group is shown in the header)
  const artifact = name.includes(':') ? name.split(':').slice(1).join(':') : name
  const logArt   = logicalName.includes(':') ? logicalName.split(':').slice(1).join(':') : logicalName
  return artifact.startsWith(logArt) ? artifact.slice(logArt.length).replace(/^[-_]/, '') || artifact : artifact
}

initAuth()
loadRepos()
`

// ---------------------------------------------------------------------------
// Public renderDashboard()
// ---------------------------------------------------------------------------

/**
 * Returns a complete HTML page for the dashboard.
 * The page is fully self-contained (no external scripts or stylesheets).
 */
export function renderDashboard(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mod Dependency Dashboard</title>
<style>${CSS}</style>
</head>
<body>

<!-- ── Header ─────────────────────────────────────────────────── -->
<header>
  <h1>🧱 Mod Dependency Dashboard</h1>
  <div class="header-actions">
    <span class="token-dot" title="Token indicator — green when token is set"></span>
    <button class="icon-btn" onclick="openDialog('dlg-settings')">⚙ Settings</button>
    <button class="icon-btn" onclick="openDialog('dlg-add')">＋ Add Repo</button>
  </div>
</header>

<!-- ── Settings dialog ────────────────────────────────────────── -->
<dialog id="dlg-settings">
  <div class="dlg-header">
    <h3>Settings</h3>
    <button class="dlg-close" onclick="document.getElementById('dlg-settings').close()">✕</button>
  </div>
  <div class="dlg-body">
    <p class="dlg-hint">Paste your write token to enable adding / removing repos and saving overrides.</p>
    <div class="dlg-field">
      <label for="dlg-token-input">Access token</label>
      <input id="dlg-token-input" type="password" placeholder="Paste token…" autocomplete="off">
    </div>
    <div class="dlg-actions">
      <span id="dlg-token-status" class="msg"></span>
      <button class="secondary" onclick="document.getElementById('dlg-settings').close()">Close</button>
      <button onclick="applyAuth()">Save</button>
    </div>
  </div>
</dialog>

<!-- ── Add repo dialog ────────────────────────────────────────── -->
<dialog id="dlg-add">
  <div class="dlg-header">
    <h3>Add Repository</h3>
    <button class="dlg-close" onclick="document.getElementById('dlg-add').close()">✕</button>
  </div>
  <div class="dlg-body">
    <div class="dlg-field">
      <label for="dlg-add-owner">Owner</label>
      <input id="dlg-add-owner" placeholder="e.g. octocat" autocomplete="off">
    </div>
    <div class="dlg-field">
      <label for="dlg-add-repo">Repository</label>
      <input id="dlg-add-repo" placeholder="e.g. my-mod"  autocomplete="off"
             onkeydown="if(event.key==='Enter') addRepo()">
    </div>
    <div class="dlg-actions">
      <span id="dlg-add-err" class="msg err"></span>
      <button class="secondary" onclick="document.getElementById('dlg-add').close()">Cancel</button>
      <button onclick="addRepo()">Add</button>
    </div>
  </div>
</dialog>

<main>

  <!-- Repo list -->
  <section>
    <h2>Repositories</h2>
    <div id="repo-grid" class="repo-grid"></div>
  </section>

  <!-- Overrides → Set Repo dialog -->
  <dialog id="dlg-set-repo">
    <div class="dlg-header">
      <h3>Set Maven Repository</h3>
      <button class="dlg-close" onclick="document.getElementById('dlg-set-repo').close()">✕</button>
    </div>
    <div class="dlg-body">
      <p class="dlg-hint">Override the Maven repository URL for: <strong id="dlg-sr-dep-label"></strong></p>
      <input type="hidden" id="dlg-sr-dep">
      <input type="hidden" id="dlg-sr-owner">
      <input type="hidden" id="dlg-sr-repo">
      <div class="dlg-field">
        <label for="dlg-sr-url">Maven repository base URL</label>
        <input id="dlg-sr-url" placeholder="https://maven.example.com/repo" autocomplete="off"
               onkeydown="if(event.key==='Enter') saveSetRepo()">
      </div>
      <div class="dlg-actions">
        <span id="dlg-sr-msg" class="msg"></span>
        <button class="secondary" onclick="document.getElementById('dlg-set-repo').close()">Cancel</button>
        <button onclick="saveSetRepo()">Save &amp; re-check</button>
      </div>
    </div>
  </dialog>

  <!-- Results -->
  <section>
    <div class="results-header">
      <h2>Dependencies</h2>
      <span id="results-repo-label" class="repo-label"></span>
      <span id="results-ctx"></span>
    </div>
    <div id="results"></div>
  </section>

</main>
<script>${JS}</script>
</body>
</html>`
}
