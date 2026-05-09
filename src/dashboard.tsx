import { renderToString } from 'hono/jsx/dom/server'

function Header() {
  return (
    <header>
      <h1>🧱 Mod Dependency Dashboard</h1>
      <div class='header-actions'>
        <span class='token-dot' title='Token indicator — green when token is set'></span>
        <button id='btn-theme-toggle' class='icon-btn theme-toggle' type='button' aria-label='Toggle theme'>◐ Theme</button>
        <button id='btn-open-settings' class='icon-btn' type='button' aria-label='Open settings'>⚙ Settings</button>
        <button id='btn-open-add' class='icon-btn' type='button' aria-label='Add repository'>＋ Add Repo</button>
      </div>
    </header>
  )
}

function SettingsDialog() {
  return (
    <dialog id='dlg-settings'>
      <div class='dlg-header'>
        <h3>Settings</h3>
        <button id='btn-close-settings-x' class='dlg-close' type='button' aria-label='Close settings'>✕</button>
      </div>
      <div class='dlg-body'>
        <p class='dlg-hint'>Paste your write token to enable adding / removing repos and saving overrides.</p>
        <div class='dlg-field'>
          <label for='dlg-token-input'>Access token</label>
          <input id='dlg-token-input' type='password' placeholder='Paste token…' autocomplete='off' />
        </div>
        <div class='dlg-actions'>
          <span id='dlg-token-status' class='msg'></span>
          <button id='btn-close-settings' class='secondary'>Close</button>
          <button id='btn-save-token'>Save</button>
        </div>
      </div>
    </dialog>
  )
}

function AddRepoDialog() {
  return (
    <dialog id='dlg-add'>
      <div class='dlg-header'>
        <h3>Add Repository</h3>
        <button id='btn-close-add-x' class='dlg-close' type='button' aria-label='Close add repository dialog'>✕</button>
      </div>
      <div class='dlg-body'>
        <div class='dlg-field'>
          <label for='dlg-add-repo-input'>GitHub URL or owner/repo</label>
          <input id='dlg-add-repo-input' placeholder='e.g. github.com/octocat/my-mod or octocat/my-mod' autocomplete='off' />
        </div>
        <div class='dlg-actions'>
          <span id='dlg-add-err' class='msg err'></span>
          <button id='btn-close-add' class='secondary'>Cancel</button>
          <button id='btn-add-repo'>Add</button>
        </div>
      </div>
    </dialog>
  )
}

function SetRepoDialog() {
  return (
    <dialog id='dlg-set-repo'>
      <div class='dlg-header'>
        <h3>Set Maven Repository</h3>
        <button id='btn-close-set-repo-x' class='dlg-close' type='button' aria-label='Close set repository dialog'>✕</button>
      </div>
      <div class='dlg-body'>
        <p class='dlg-hint'>
          Override the Maven repository URL for: <strong id='dlg-sr-dep-label'></strong>
        </p>
        <input type='hidden' id='dlg-sr-dep' />
        <input type='hidden' id='dlg-sr-owner' />
        <input type='hidden' id='dlg-sr-repo' />
        <div class='dlg-field'>
          <label for='dlg-sr-url'>Maven repository base URL</label>
          <input id='dlg-sr-url' placeholder='https://maven.example.com/repo' autocomplete='off' />
        </div>
        <div class='dlg-actions'>
          <span id='dlg-sr-msg' class='msg'></span>
          <button id='btn-close-set-repo' class='secondary'>Cancel</button>
          <button id='btn-save-set-repo'>Save &amp; re-check</button>
        </div>
      </div>
    </dialog>
  )
}

function DashboardMain() {
  return (
    <main>
      <section>
        <h2>Repositories</h2>
        <div class='repo-row'>
          <select id='repo-select' aria-label='Select repository'></select>
          <button id='btn-remove-repo' type='button' class='icon-btn' style='display:none' aria-label='Remove selected repository'>✕ Remove</button>
        </div>
      </section>
      <SetRepoDialog />

      <section>
        <div class='results-header'>
          <h2>Dependencies</h2>
          <span id='results-repo-label' class='repo-label'></span>
          <span id='results-ctx'></span>
        </div>
        <p id='results-status' class='sr-only' role='status' aria-live='polite' aria-atomic='true'></p>
        <div id='results'></div>
      </section>
    </main>
  )
}

function DashboardDocument() {
  return (
    <html lang='en'>
      <head>
        <meta charSet='UTF-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <title>Mod Dependency Dashboard</title>
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='' />
        <link href='https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&display=swap' rel='stylesheet' />
        <link rel='stylesheet' href='/app.css' />
      </head>
      <body>
        <Header />
        <SettingsDialog />
        <AddRepoDialog />
        <DashboardMain />
        <script src='/app.js'></script>
      </body>
    </html>
  )
}

export function renderDashboard(): string {
  return '<!DOCTYPE html>' + renderToString(<DashboardDocument />)
}
