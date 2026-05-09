import { describe, expect, it } from 'vitest'
import { renderDashboard } from '../dashboard.tsx'

describe('dashboard accessibility anchors', () => {
  it('renders a dedicated polite live region for results status updates', () => {
    const html = renderDashboard()

    expect(html).toContain('id="results-status"')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-atomic="true"')
  })

  it('does not render version template panel or template how-to copy', () => {
    const html = renderDashboard()

    expect(html).not.toContain('id="version-template-panel"')
    expect(html).not.toContain('id="version-template-select"')
    expect(html).not.toContain('id="template-version-input"')
    expect(html).not.toContain('How to use')
  })
})
