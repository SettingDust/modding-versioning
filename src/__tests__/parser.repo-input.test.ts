import { describe, expect, it } from 'vitest'
import { parseGitHubRepoInput } from '../parser.ts'

describe('parseGitHubRepoInput', () => {
  it('parses URL forms and strips trailing .git', () => {
    expect(parseGitHubRepoInput('https://github.com/owner/repo')).toEqual({ owner: 'owner', repo: 'repo' })
    expect(parseGitHubRepoInput('http://github.com/owner/repo')).toEqual({ owner: 'owner', repo: 'repo' })
    expect(parseGitHubRepoInput('github.com/owner/repo')).toEqual({ owner: 'owner', repo: 'repo' })
    expect(parseGitHubRepoInput('https://github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('allows trailing slash/query/fragment and ignores them for parsing', () => {
    expect(parseGitHubRepoInput('https://github.com/owner/repo/?tab=readme#intro')).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses owner/repo text form', () => {
    expect(parseGitHubRepoInput('Owner-Name/Repo_Name')).toEqual({ owner: 'Owner-Name', repo: 'Repo_Name' })
  })

  it('rejects invalid host and invalid path shapes', () => {
    expect(parseGitHubRepoInput('https://gitlab.com/owner/repo')).toBeNull()
    expect(parseGitHubRepoInput('https://github.com/owner/repo/issues')).toBeNull()
    expect(parseGitHubRepoInput('https://github.com/owner')).toBeNull()
  })

  it('returns null for malformed percent-encoding in URL path segments', () => {
    expect(parseGitHubRepoInput('https://github.com/%E0%A4%A/repo')).toBeNull()
    expect(parseGitHubRepoInput('https://github.com/owner/%E0%A4%A')).toBeNull()
  })
})
