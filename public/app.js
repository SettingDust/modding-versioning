
const API = ''
const THEME_KEY = 'mvd_theme'

function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getPreferredTheme() {
  const saved = safeStorageGet(THEME_KEY, '')
  return saved === 'dark' || saved === 'light' ? saved : getSystemTheme()
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.body.dataset.theme = theme
  const btn = document.getElementById('btn-theme-toggle')
  if (btn) {
    btn.textContent = theme === 'dark' ? '◐ Dark' : '◐ Light'
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')
  }
}

function initTheme() {
  applyTheme(getPreferredTheme())
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || getPreferredTheme()
  const next = current === 'dark' ? 'light' : 'dark'
  safeStorageSet(THEME_KEY, next)
  applyTheme(next)
}

function safeStorageGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

let token = safeStorageGet('mvd_token', '') || ''
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

function closeDialog(id) {
  document.getElementById(id)?.close()
}

function bindStaticHandlers() {
  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme)
  document.getElementById('btn-open-settings')?.addEventListener('click', () => openDialog('dlg-settings'))
  document.getElementById('btn-open-add')?.addEventListener('click', () => openDialog('dlg-add'))
  document.getElementById('repo-select').addEventListener('change', function () {
    selectRepo(this.value)
    updateRemoveBtn()
  })
  document.getElementById('btn-remove-repo').addEventListener('click', removeRepo)

  document.getElementById('btn-close-settings-x')?.addEventListener('click', () => closeDialog('dlg-settings'))
  document.getElementById('btn-close-settings')?.addEventListener('click', () => closeDialog('dlg-settings'))
  document.getElementById('btn-save-token')?.addEventListener('click', applyAuth)

  document.getElementById('btn-close-add-x')?.addEventListener('click', () => closeDialog('dlg-add'))
  document.getElementById('btn-close-add')?.addEventListener('click', () => closeDialog('dlg-add'))
  document.getElementById('btn-add-repo')?.addEventListener('click', addRepo)
  document.getElementById('dlg-add-repo-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addRepo()
  })

  document.getElementById('btn-close-set-repo-x')?.addEventListener('click', () => closeDialog('dlg-set-repo'))
  document.getElementById('btn-close-set-repo')?.addEventListener('click', () => closeDialog('dlg-set-repo'))
  document.getElementById('btn-save-set-repo')?.addEventListener('click', saveSetRepo)
  document.getElementById('dlg-sr-url')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveSetRepo()
  })
}

// ── Auth ────────────────────────────────────────────────────────────────────
function applyAuth() {
  const input = document.getElementById('dlg-token-input')
  token = input.value.trim()
  if (token) safeStorageSet('mvd_token', token)
  else safeStorageRemove('mvd_token')
  document.body.classList.toggle('authed', !!token)
  document.getElementById('dlg-token-status').textContent = token ? 'Token saved.' : 'Token cleared.'
  updateRemoveBtn()
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

function updateRemoveBtn() {
  const sel = document.getElementById('repo-select')
  const btn = document.getElementById('btn-remove-repo')
  if (!sel || !btn) return
  const authed = document.body.classList.contains('authed')
  btn.style.display = (authed && sel.value) ? '' : 'none'
}

function renderRepos(repos) {
  const sel = document.getElementById('repo-select')
  const prev = sel.value
  sel.innerHTML = '<option value="">All</option>'
  for (const { owner, repo } of repos) {
    const opt = document.createElement('option')
    opt.value = owner + '/' + repo
    opt.textContent = owner + '/' + repo
    sel.appendChild(opt)
  }
  if (prev && [...sel.options].some(o => o.value === prev)) {
    sel.value = prev
  } else if (_filterRepo && [...sel.options].some(o => o.value === _filterRepo)) {
    sel.value = _filterRepo
  } else {
    sel.value = ''
  }
  updateRemoveBtn()
}

function selectRepo(key) {
  _filterSource = null
  _filterRepo = key || null
  if (key) {
    history.replaceState(null, '', location.pathname + '?repo=' + encodeURIComponent(key))
  } else {
    history.replaceState(null, '', location.pathname)
  }
  renderAll()
}

async function addRepo() {
  const repoInput = document.getElementById('dlg-add-repo-input').value.trim()
  if (!repoInput) return
  const res = await fetch(API + '/api/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ repoInput }),
  })
  if (res.ok) {
    document.getElementById('dlg-add-repo-input').value = ''
    const repos = await res.json()
    const added = Array.isArray(repos) && repos.length ? repos[repos.length - 1] : null
    document.getElementById('dlg-add').close()
    // Add new repo slot and start checking it
    if (added?.owner && added?.repo) {
      allRepoResults.push({ owner: added.owner, repo: added.repo, status: 'loading', data: null, error: null })
      renderAll()
      checkRepo(added.owner, added.repo)
    }
    loadRepos()
  } else {
    document.getElementById('dlg-add-err').textContent = await res.text()
  }
}

async function removeRepo() {
  const sel = document.getElementById('repo-select')
  const val = sel?.value
  if (!val) return
  const slashIdx = val.indexOf('/')
  if (slashIdx === -1) return
  const owner = val.slice(0, slashIdx)
  const repo = val.slice(slashIdx + 1)
  if (!confirm('Remove ' + val + '?')) return
  await fetch(API + `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  allRepoResults = allRepoResults.filter(r => !(r.owner === owner && r.repo === repo))
  if (_filterRepo === val) _filterRepo = null
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
    const params = new URLSearchParams({ owner, repo })
    if (token) params.set('token', token)
    const url = `${API}/api/stream?${params.toString()}`
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
      // EventSource emits 'error' for both explicit server errors and transport close.
      // Only mark repo as failed for explicit error payloads or when nothing was received.
      if (slot.status === 'loading') {
        let explicitMessage = null
        if (ev instanceof MessageEvent && typeof ev.data === 'string' && ev.data.trim()) {
          try {
            const payload = JSON.parse(ev.data)
            if (payload && typeof payload.message === 'string' && payload.message.trim()) {
              explicitMessage = payload.message
            } else {
              explicitMessage = ev.data
            }
          } catch {
            explicitMessage = ev.data
          }
        }

        const hasAnyData = (slot.receivedDeps?.length ?? 0) > 0
        if (!explicitMessage && hasAnyData) {
          // Keep partial results visible without an error banner.
          es.close()
          slot.status = 'ok'
          slot.checking = null
          if (slot.data) slot.data = { context: slot.context, groups: groupDepsJS(slot.receivedDeps) }
          scheduleRender()
          resolve()
          return
        }

        es.close()
        slot.status = 'error'
        const message = explicitMessage || 'Stream connection failed'
        slot.error = message
        scheduleRender()
        resolve()
      }
    })
  })
}

// ── Render all (with optional repo + source filter) ──────────────────────────
function renderAll() {
  const resultsEl = document.getElementById('results')
  const statusEl = document.getElementById('results-status')

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
  const chipsHtml = sourcesPresent.length ? `<div class="filter-chips">${
    sourcesPresent.map(src => {
      const active = _filterSource === src ? ' active' : ''
      const label = { modrinth:'Modrinth', curseforge:'CurseForge', fabric:'Fabric', forge:'Forge', neoforge:'NeoForge', maven:'Maven' }[src] || 'Unknown'
      const count = allGroups.filter(g => g.source === src).length
      const pressed = _filterSource === src ? 'true' : 'false'
      return `<button class="chip${active}" aria-pressed="${pressed}" onclick="setFilterSource('${esc(src)}')">${esc(label)} (${count})</button>`
    }).join('')
  }</div>` : ''

  const loadingHtml = loading.length
    ? loading.map(r => {
        const s = allRepoResults.find(x => x.owner === r.owner && x.repo === r.repo)
        const received = s?.receivedDeps?.length ?? 0
        const total = s?.total ?? null
        const pct = total ? Math.round(received / total * 100) : 0
        const checkingName = s?.checking ? esc(s.checking.replace(/^[^:]+:/, '')) : null
        const label = total !== null
          ? `Checking ${esc(r.owner + '/' + r.repo)} — ${received} / ${total}${checkingName ? ` · <span class="progress-dep">${checkingName}</span>` : ''}…`
          : `Checking ${esc(r.owner + '/' + r.repo)}…`
        return `<p id="loading">${label}</p>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`
      }).join('')
    : ''
  const errHtml = errors.map(r =>
    `<p class="msg err">${esc(r.owner + '/' + r.repo)}: ${esc(r.error || 'Failed')}</p>`
  ).join('')

  const filtered = _filterSource ? allGroups.filter(g => g.source === _filterSource) : allGroups
  const setResultsStatus = (message) => {
    if (statusEl) statusEl.textContent = message
  }

  if (!filtered.length) {
    if (!repoResults.length) setResultsStatus('No repositories selected.')
    else if (loading.length) setResultsStatus(`Checking ${loading.length} repos.`)
    else if (errors.length) setResultsStatus(`No dependencies found. ${errors.length} repository checks failed.`)
    else setResultsStatus('No dependencies found.')
    // If still loading but no deps arrived yet, show progress only; no "empty" message
    resultsEl.innerHTML = loadingHtml + errHtml + (loading.length && !withData.length ? '' : '<p class="empty">No dependencies found.</p>')
    return
  }

  const outdatedCount = filtered.reduce((sum, group) => sum + group.variants.filter(v => v.upToDate === false).length, 0)
  const loadingSuffix = loading.length ? `, ${loading.length} checking` : ''
  setResultsStatus(`${filtered.length} dependency groups shown, ${outdatedCount} outdated${loadingSuffix}.`)

  let rows = ''
  for (const g of filtered) {
    const owner = g._owner, repo = g._repo
    if (g.variants.length === 1) {
      const v = g.variants[0]
      rows += `<tr class="${v.upToDate === false ? 'row-outdated' : 'row-ok'}">
        <td>${esc(shortArtifact(v.name))}</td>
        <td>${badge(g.source, v)}${setRepoBtn(v, owner, repo)}</td>
        <td>${esc(v.currentVersion)}</td>
        ${statusTd(v)}
        <td>${declaredInCell(v, owner, repo)}</td>
      </tr>`
    } else {
      const outdatedCount = g.variants.filter(v => v.upToDate === false).length
      const headerStatus = g.anyOutdated
        ? `<td class="status status-outdated">${outdatedCount} outdated</td>`
        : `<td class="status status-ok">all up to date</td>`
      rows += `<tr class="group-header ${g.anyOutdated ? 'group-outdated' : 'group-ok'}">
        <td>${esc(shortLogical(g.logicalName))}</td>
        <td>${badge(g.source, g.variants[0])}</td>
        <td></td>
        ${headerStatus}
        <td></td>
      </tr>`
      for (const v of g.variants) {
        rows += `<tr class="variant-row ${v.upToDate === false ? 'row-outdated' : 'row-ok'}">
          <td>${esc(variantSuffix(v.name, g.logicalName))}</td>
          <td>${setRepoBtn(v, owner, repo)}</td>
          <td>${esc(v.currentVersion)}</td>
          ${statusTd(v)}
          <td>${declaredInCell(v, owner, repo)}</td>
        </tr>`
      }
    }
  }

  resultsEl.innerHTML = loadingHtml + errHtml + chipsHtml + `<table>
    <thead><tr>
      <th>Dependency</th>
      <th>Source</th>
      <th>Current</th>
      <th>Latest / Status</th>
      <th>Declared in</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function setFilterSource(src) {
  _filterSource = _filterSource === src ? null : src
  renderAll()
}

function renderContextBadges(ctx) {
  if (!ctx) return ''
  const parts = []
  if (ctx.mcVersion) parts.push(`<span class="ctx-badge">MC ${esc(ctx.mcVersion)}</span>`)
  for (const l of (ctx.loaders || [])) {
    const v = ctx.loaderVersions?.[l]
    const vStr = v ? ` ${esc(v)}` : ''
    parts.push(`<span class="ctx-badge loader-${esc(l)}">⬡ ${esc(l)}${vStr}</span>`)
  }
  return parts.join('')
}

function declaredInCell(v, owner, repo) {
  if (!v.declaredIn) return '<span style="color:var(--muted)">—</span>'
  const { file, line } = v.declaredIn
  const href = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/HEAD/${file}#L${line}`
  return `<a class="decl-link" href="${esc(href)}" target="_blank" rel="noopener">${esc(file)}:${line}</a>`
}

function setRepoBtn(v, owner, repo) {
  if (v.source !== 'maven' && v.source !== 'unknown') return ''
  return ` <button class="set-repo-btn" onclick="openSetRepo('${esc(v.name)}','${esc(owner)}','${esc(repo)}','${esc(v.mavenRepo||'')}')">Set Repo</button>`
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
  const res = await fetch(`${API}/api/overrides?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`, {
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
  if (v.upToDate === null) {
    const msg = v.latestError ? esc(v.latestError) : 'Latest version unavailable'
    return `<td class="status status-unknown" title="${msg}">—</td>`
  }
  const ver = v.latestVersion
    ? `<code class="v-copy" title="Click to copy" data-ver="${esc(v.latestVersion)}" onclick="copyVer(this)">${esc(v.latestVersion)}</code>`
    : ''
  if (v.upToDate) return `<td class="status status-ok">✓ ${ver}</td>`
  return `<td class="status status-outdated">⚠ ${ver}</td>`
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function sourceHomeUrl(src, dep) {
  if (src === 'fabric') return 'https://fabricmc.net/develop/'
  if (src === 'forge') return 'https://files.minecraftforge.net/net/minecraftforge/forge/'
  if (src === 'neoforge') return 'https://projects.neoforged.net/neoforged/neoforge'
  if (src === 'modrinth') {
    const slug = dep?.identifier
    if (slug) return 'https://modrinth.com/mod/' + encodeURIComponent(slug)
    return 'https://modrinth.com/mods'
  }
  if (src === 'curseforge') {
    const projectId = dep?.identifier
    if (projectId && /^\d+$/.test(projectId)) return 'https://www.curseforge.com/projects/' + encodeURIComponent(projectId)
    return 'https://www.curseforge.com/minecraft/mc-mods'
  }
  if (src === 'maven') {
    const repo = safeHttpUrl(dep?.mavenRepo || '')
    if (!repo) return null
    const [group, artifact] = String(dep?.identifier || dep?.name || '').split(':')
    if (!group || !artifact) return repo
    const base = repo.replace(/\/+$/, '') + '/'
    return base + group.replace(/\./g, '/') + '/' + artifact + '/'
  }
  return null
}

function safeHttpUrl(raw) {
  if (!raw) return null
  try {
    const u = new URL(String(raw))
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString()
  } catch {}
  return null
}

function badge(src, dep) {
  const cls = { modrinth:'badge-modrinth', curseforge:'badge-curseforge', fabric:'badge-fabric', forge:'badge-forge', neoforge:'badge-neoforge', maven:'badge-maven' }[src] || 'badge-unknown'
  const lbl = { modrinth:'Modrinth', curseforge:'CurseForge', fabric:'Fabric', forge:'Forge', neoforge:'NeoForge', maven:'Maven' }[src] || 'Unknown'
  const inner = `<span class="badge ${cls}">${lbl}</span>`
  const href = sourceHomeUrl(src, dep)
  if (!href) return inner
  return `<a class="badge-link" href="${esc(href)}" target="_blank" rel="noopener" title="Open ${esc(lbl)} page">${inner}</a>`
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

bindStaticHandlers()
initTheme()
initAuth()
loadRepos()
