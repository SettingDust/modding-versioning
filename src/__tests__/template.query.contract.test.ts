import { describe, expect, it } from 'vitest'

describe('check endpoint query contract', () => {
  it('uses only owner and repo as required query keys', () => {
    const params = new URLSearchParams('owner=octocat&repo=my-mod')

    expect(params.get('owner')).toBe('octocat')
    expect(params.get('repo')).toBe('my-mod')
    expect(params.get('templateId')).toBeNull()
    expect(params.get('templateInput')).toBeNull()
    expect(params.get('templateRegex')).toBeNull()
    expect(params.get('templatePayload')).toBeNull()
  })
})
