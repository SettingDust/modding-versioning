
const API = ''

let token = localStorage.getItem('mvd_token') || ''
// Array of { owner, repo, status: 'loading'|'ok'|'error', data, error }
let allRepoResults = []
let _filterRepo  = null   // 'owner/repo' string or null
let _filterSource = null  // source string or null

// 鈹€鈹€ Dialog helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
  document.getElementById('btn-open-settings')?.addEventListener('click', () => openDialog('dlg-settings'))
  document.getElementById('btn-open-add')?.addEventListener('click', () => openDialog('dlg-add'))

  document.getElementById('btn-close-settings-x')?.addEventListener('click', () => closeDialog('dlg-settings'))
  document.getElementById('btn-close-settings')?.addEventListener('click', () => closeDialog('dlg-settings'))
  document.getElementById('btn-save-token')?.addEventListener('click', applyAuth)

  document.getElementById('btn-close-add-x')?.addEventListener('click', () => closeDialog('dlg-add'))
  document.getElementById('btn-close-add')?.addEventListener('click', () => closeDialog('dlg-add'))
  document.getElementById('btn-add-repo')?.addEventListener('click', addRepo)
  document.getElementById('dlg-add-repo')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addRepo()
  })

  document.getElementById('btn-close-set-repo-x')?.addEventListener('click', () => closeDialog('dlg-set-repo'))
  document.getElementById('btn-close-set-repo')?.addEventListener('click', () => closeDialog('dlg-set-repo'))
  document.getElementById('btn-save-set-repo')?.addEventListener('click', saveSetRepo)
  document.getElementById('dlg-sr-url')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveSetRepo()
  })
}

// 鈹€鈹€ Auth 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ Repo list 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
    grid.innerHTML = '<span style="color:var(--muted);font-size:.9rem">No repos yet 鈥?click + Add Repo</span>'
    return
  }
  for (const { owner, repo } of repos) {
    const card = document.createElement('div')
    card.className = 'repo-card'
    card.dataset.key = owner + '/' + repo
    card.innerHTML = \
