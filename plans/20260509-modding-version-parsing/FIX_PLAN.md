# Minecraft Mod Version Parsing - Fix Plan (Updated)

**Created**: May 9, 2026  
**Updated**: May 9, 2026  
**Status**: Planning (scope expanded)  
**Total Tasks**: 7 (3 waves, Wave 2 expanded to 4 subtasks)

---

## Overview

This fix plan addresses incomplete version-format support and improves UX through UI enhancements. The current system has gaps when handling `+`-separated version formats, four-segment versions, and mixed loader/MC version suffixes. In addition, new UI features let users quickly choose a version-format template from a dropdown or define custom formats.

### Scope (7 tasks across 3 waves)

```
Wave 1: L1 Required (blocking)       - 2 tasks - 3h
Wave 2: L2 Important (format + UI)   - 4 tasks - 9h
Wave 3: L3 Investigation (optional)  - 1 task  - 2-3h
────────────────────────────────────────────────
Total:                               - 7 tasks - 14-15h
```

---

## Wave 1: Required Fixes (L1 - Critical)

### Task 1a: Modrinth Maven normalization fix (support `+` separator)

**Files**: src/detector.ts (L122-L135)  
**Priority**: Required ⚡  
**Complexity**: ⭐⭐

#### Problem
In the Modrinth Maven source, formats like `0.7.6+1.21+neoforge` cannot be normalized correctly.

#### Acceptance Criteria
- ✓ `0.7.6+1.21+neoforge` → normalized to `0.7.6`
- ✓ `mc1.21.1-0.6.0+build.24` → normalized to `0.6.0+build.24`
- ✓ `mc1.20.1-2.5.0` → normalized to `2.5.0`
- ✓ `1.2.0` (plain version) → remains `1.2.0`

#### Implementation Notes

Current code:
```typescript
const normalizedVersion = version.replace(/^mc\d+\.\d+(?:\.\d+)?-/, '')
```

Change to:
```typescript
const normalizedVersion = version
  .replace(/^mc\d+\.\d+(?:\.\d+)?-/, '')                    // Strip mc prefix
  .replace(/\+\d+\.\d+(?:\.\d+)?(?=\+|$)/, '')             // Strip +MC_VERSION
  .replace(/\+(?:forge|neoforge|fabric|quilt|common|lexforge|klf)$/i, '') // Strip +loader
```

#### Test Strategy
- Unit tests: 8 cases (parameterized)
- Integration tests: 2 cases (real Modrinth API)
- Regression tests: 5 cases (existing formats)

**Estimated Time**: 1h

---

### Task 1b: Modrinth dependency context extraction fix (support `+` separator)

**Files**: src/checker.ts (L88-L145)  
**Priority**: Required ⚡  
**Complexity**: ⭐⭐⭐

#### Problem
`extractModrinthDepContext` only supports `-`-separated version filters and cannot handle `+` separators.

#### Acceptance Criteria
- ✓ `0.7.6+1.21+neoforge` → extract loader=neoforge, MC=1.21
- ✓ `1.2.0+fabric` → extract loader=fabric, MC=null
- ✓ `0.7.6-fabric` → existing behavior preserved, loader=fabric
- ✓ `3.0.9-fabric,1.20.2` → loader=fabric, MC=1.20.2
- ✓ `1.2.0-1.19.4-forge` → loader=forge, MC=1.19.4

#### Implementation Notes

Extend version-filter parsing logic:
1. Support both `-` and `+` separators
2. Priority: last `-` > last `+`
3. Parse loader and MC version tokens from the suffix after the separator

#### Test Strategy
- Unit tests: 5 cases
- Integration tests: 3 cases
- Regression tests: 5 cases

**Estimated Time**: 2h

---

## Wave 2: Important Fixes + UI Features (L2 - Important)

### Task 2a: Extend version regex (four-segment support)

**Files**: src/detector.ts (L32-L38)  
**Priority**: Important ⭐  
**Complexity**: ⭐

#### Problem
The suffix-removal regex cannot handle four-segment versions like `26.1.2.4`.

#### Acceptance Criteria
- ✓ `bookshelf-lib-26.1.2.4-fabric` → suffix removed to `bookshelf-lib`
- ✓ `bookshelf-lib-20.2.15-fabric` → `bookshelf-lib`
- ✓ `dynamictrees-1.20.1` → `dynamictrees`
- ✓ `jei-238222` → unchanged (not a version number)

#### Implementation Notes

Update MC_VERSION_RE:
```typescript
// From:
/-\d+\.\d+(\.\d+)?$/

// To:
/-\d+\.\d+(?:\.\d+){0,2}$/  // Supports 2-4 segments
```

**Estimated Time**: 1h

---

### Task 2b: Extend version validation (recognize four-segment versions)

**Files**: src/checker.ts (L101-L103)  
**Priority**: Important ⭐  
**Complexity**: ⭐

#### Problem
Version-format checks in `versionsMatchForDisplay` do not recognize four-segment versions.

#### Acceptance Criteria
- ✓ `26.1.2.4` is recognized as a valid version format
- ✓ `1.2.0-26.1.2.4` vs `1.2.0-forge,26.1.2.4` comparison is correct
- ✓ Single-number `238222` is **not** recognized as a version format

#### Implementation Notes

Extract version-format check as a constant:
```typescript
const VERSION_FORMAT_RE = /^\d+\.\d+(?:\.\d+){0,2}$/  // 2-4 segments

// Applied in versionsMatchForDisplay
if (suffixTokens.every(token =>
  VERSION_FILTER_LOADERS.has(token) || VERSION_FORMAT_RE.test(token)
)) {
  return true
}
```

**Estimated Time**: 1h

---

### Task 2c: Implement UI dropdown - preset source version templates

**Files**: src/dashboard.tsx, src/types.ts  
**Priority**: Important (UI improvement)  
**Complexity**: ⭐⭐

#### Feature Description
Add a dropdown to version-checking UI so users can quickly choose source-specific version format templates.

#### UI Placement

```
Dashboard version input area:

📋 Source template:  [Maven ▼]

Template description: Uses + separator, supports MC version and loader suffixes

Example versions:
  • 0.7.6+1.21+neoforge        [Copy]
  • mc1.21.1-0.6.0+build.24    [Copy]

[Custom...] ← links to Task 2d
```

#### Source Template Config Structure

Define in `src/types.ts`:

```typescript
interface VersionTemplate {
  id: string                    // "maven" | "modrinth" | "fabric" | "forge"
  label: string                 // UI label: "Maven Repository (Modrinth)"
  source: 'maven' | 'modrinth' | 'fabric' | 'forge' | 'neoforge' | 'custom'
  description: string           // Format description: "Uses + separator..."
  regex: string                 // Validation regex: "^\\d+\\.\\d+..."
  examples: string[]            // Sample versions
  separators: string[]          // Separators used: ['+', '-']
  features: {
    loaderSupport: boolean      // Supports loader suffix
    mcVersionSupport: boolean   // Supports MC version
    buildMetadata: boolean      // Supports +build.24
    multiSegmentVersion: boolean // Supports four-segment versions
  }
}

// Presets (at least 4 templates)
const VERSION_TEMPLATES: Record<string, VersionTemplate> = {
  maven: {
    id: "maven",
    label: "Maven Repository (Modrinth)",
    source: "maven",
    description: "Uses + separated format and supports MC version and loader suffixes",
    regex: "^\\d+\\.\\d+(?:\\.\\d+)*(?:\\+\\d+\\.\\d+(?:\\.\\d+)?)?(?:\\+[a-z]+)?$",
    examples: ["0.7.6", "0.7.6+1.21", "0.7.6+1.21+neoforge", "mc1.21.1-0.6.0+build.24"],
    separators: ['+', '-'],
    features: {
      loaderSupport: true,
      mcVersionSupport: true,
      buildMetadata: true,
      multiSegmentVersion: true
    }
  },

  modrinth: {
    id: "modrinth",
    label: "Modrinth",
    source: "modrinth",
    description: "Uses - separated format and supports four-segment versions and loader suffixes",
    regex: "^\\d+\\.\\d+(?:\\.\\d+){0,2}(?:-[a-z]+)?(?:,\\d+\\.\\d+(?:\\.\\d+)?)?$",
    examples: ["26.1.2.4", "26.1.2.4-fabric", "20.2.15-fabric,1.20.1", "1.2.0"],
    separators: ['-', ','],
    features: {
      loaderSupport: true,
      mcVersionSupport: true,
      buildMetadata: false,
      multiSegmentVersion: true
    }
  },

  fabric: {
    id: "fabric",
    label: "Fabric Official Repository",
    source: "fabric",
    description: "Version format commonly used in the Fabric registry, usually MC version only",
    regex: "^\\d+\\.\\d+(?:\\.\\d+)?$",
    examples: ["1.20.1", "1.20.2", "1.21.1"],
    separators: [],
    features: {
      loaderSupport: false,
      mcVersionSupport: false,
      buildMetadata: false,
      multiSegmentVersion: false
    }
  },

  forge: {
    id: "forge",
    label: "Forge",
    source: "forge",
    description: "Forge version format, supports loader suffix and MC version",
    regex: "^\\d+\\.\\d+(?:\\.\\d+)?-?(?:forge|neoforge)?(?:-\\d+\\.\\d+(?:\\.\\d+)?)?$",
    examples: ["1.20.1-47.4.4", "47.4.4", "1.20.1-forge"],
    separators: ['-'],
    features: {
      loaderSupport: true,
      mcVersionSupport: true,
      buildMetadata: false,
      multiSegmentVersion: true
    }
  }
}
```

#### Acceptance Criteria

- ✓ Dropdown appears next to the version input field
- ✓ Dropdown includes at least 4 presets (Maven, Modrinth, Fabric, Forge)
- ✓ Selecting a template displays description and sample versions
- ✓ Users can click sample versions to copy/fill the input
- ✓ Last dropdown item is "Custom...", linking to Task 2d
- ✓ Preset template config is stored in types.ts for maintainability
- ✓ Selected template info is passed to version detection logic

#### Test Strategy

**Unit tests** (6 cases):
- Validate data structure of all template presets
- Validate all examples match their corresponding regex
- Validate template feature flags

**Integration tests** (3 cases):
- Trigger version detection after selecting a template
- Validate dropdown integration with detection logic
- Validate sample-version copy behavior

**UI tests** (5 flows):
- Open Dashboard and verify dropdown rendering
- Switch templates and verify description/examples update
- Click sample version and verify copy/fill behavior
- Enter version in input and run detection
- Switch across multiple templates

**Estimated Time**: 3h

---

### Task 2d: Custom regex input - allow user-defined version formats

**Files**: src/dashboard.tsx, src/types.ts, src/detector.ts  
**Priority**: Important (extended capability)  
**Complexity**: ⭐⭐⭐

#### Feature Description
Provide a custom-regex input area for sources not covered by presets. Users can define new version formats to improve system extensibility.

#### UI Placement

```
Dashboard custom format area (collapsible):

📝 Format name:
[Special Source v2 ______________________________________]

Regex pattern:
[^\\d+\\.\\d+\\.\\d+$ ______________________________]

Format description (optional):
[Supports 3-segment versions _____________________________]

Test version:
[1.2.3 ____________]  [Test]  ✓ Match

[Save Config]  [Cancel]

Saved custom formats:
┌─ Special Source v2 (ID: uuid-1)
│  ✓ Regex: ^\\d+\\.\\d+\\.\\d+$
│  [Edit]  [Delete]  [Use]
│
└─ Another format (ID: uuid-2)
   ✓ Regex: ...
   [Edit]  [Delete]  [Use]
```

#### Source Template Config Structure

Extend `src/types.ts`:

```typescript
interface CustomVersionTemplate extends VersionTemplate {
  id: string              // UUID or auto-generated ID
  isCustom: boolean       // Always true
  createdAt: Date         // Creation time
  updatedAt: Date         // Last update time
}

interface VersionTemplateStorage {
  custom_templates: CustomVersionTemplate[]
  last_used_template?: string
  template_history?: Array<{
    id: string
    timestamp: Date
    examples: string[]
  }>
}

interface TemplateValidationResult {
  valid: boolean
  errors: string[]        // Why validation failed
  warnings: string[]      // Warning info (for example mismatches)
}

function validateCustomTemplate(template: Partial<CustomVersionTemplate>): TemplateValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate non-empty format name
  if (!template.label || template.label.trim().length === 0) {
    errors.push("Format name cannot be empty")
  }

  // Validate regex syntax
  if (!template.regex || template.regex.trim().length === 0) {
    errors.push("Regex cannot be empty")
  } else {
    try {
      new RegExp(template.regex)
    } catch (e) {
      errors.push(`Regex error: ${e.message}`)
    }
  }

  // Validate sample versions against regex
  if (template.regex && template.examples && template.examples.length > 0) {
    try {
      const re = new RegExp(template.regex)
      const unmatchedExamples = template.examples.filter(ex => !re.test(ex))
      if (unmatchedExamples.length > 0) {
        warnings.push(`Examples not matching regex: ${unmatchedExamples.join(', ')}`)
      }
    } catch (e) {
      // Ignore: regex validity already checked above
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

function loadCustomTemplates(): CustomVersionTemplate[] {
  const storage = JSON.parse(localStorage.getItem('versionTemplateStorage') || '{}')
  return storage.custom_templates || []
}

function saveCustomTemplate(template: CustomVersionTemplate): void {
  const storage = JSON.parse(localStorage.getItem('versionTemplateStorage') || '{}')
  storage.custom_templates = storage.custom_templates || []
  const existing = storage.custom_templates.findIndex(t => t.id === template.id)
  if (existing >= 0) {
    storage.custom_templates[existing] = template
  } else {
    storage.custom_templates.push(template)
  }
  localStorage.setItem('versionTemplateStorage', JSON.stringify(storage))
}

function deleteCustomTemplate(id: string): void {
  const storage = JSON.parse(localStorage.getItem('versionTemplateStorage') || '{}')
  storage.custom_templates = (storage.custom_templates || []).filter(t => t.id !== id)
  localStorage.setItem('versionTemplateStorage', JSON.stringify(storage))
}
```

#### Acceptance Criteria

- ✓ Users can input format name, regex pattern, description, and sample versions
- ✓ Regex validity is checked in real time with error/warning display
- ✓ A "Test" action is provided to verify version input against regex
- ✓ Saved custom formats persist in local storage
- ✓ Saved custom formats appear in Task 2c dropdown
- ✓ Users can edit and delete saved custom formats
- ✓ Custom regex is applied in the same detection flow as preset templates
- ✓ Supports at least 5 concurrent custom formats

#### Test Strategy

**Unit tests** (8 cases):
- Validate different scenarios in validateCustomTemplate
- Validate save/load behavior in localStorage
- Validate UUID generation and duplicate checks

**Integration tests** (4 cases):
- Detect versions after creating custom format
- Edit custom format and re-run detection
- Delete custom format
- Integrate with Task 2c dropdown

**UI tests** (6 flows):
- Open custom-input panel
- Enter valid/invalid regex and verify validation messages
- Enter test version and verify match result display
- Save custom format and verify dropdown presence
- Edit and delete custom formats
- Reload page and verify persisted formats still exist

**Estimated Time**: 4h

---

## Wave 3: Investigation Task (L3 - Investigation)

### Task 3a: preloading_tricks repository lookup investigation

**Files**: src/repos.ts, src/checker.ts  
**Priority**: Optional  
**Complexity**: ⭐⭐⭐

#### Problem Statement
While building Modrinth dependencies, repository lookup fails for repositories such as `preloading_tricks`.

#### Investigation Checklist

1. **Confirm problem scope**
   - [ ] Check whether there are dependencies referencing a repo named `preloading_tricks`
   - [ ] Find where this repo is referenced (build.gradle.kts or other sources)
   - [ ] Confirm error message and returned status

2. **Code review**
   - [ ] Review implementation of `case 'unknown'` in `resolveLatestVersion`
   - [ ] Inspect fallback repo construction logic
   - [ ] Verify `getLatestMavenVersion` can handle repository URLs correctly

#### Acceptance Criteria
- ✓ Confirm whether `preloading_tricks` repository exists
- ✓ If it exists, fix lookup logic to make it discoverable
- ✓ If it does not exist, verify error handling and logging quality
- ✓ Provide investigation report and solution

**Estimated Time**: 2-3h

---

## Execution Flow Summary

### Recommended Order

```
1️⃣ Wave 1 (3h, blocking path)
   Task 1a → Task 1b (sequential, dependent)
   ✓ + separated format support passes

2️⃣ Wave 2a/2b (2h, depends on Wave 1)
   Task 2a ⟂ Task 2b (parallelizable)
   ✓ Four-segment version support passes

3️⃣ Wave 2c/2d (7h, parallel with 2a/2b)
   Task 2c ⟂ Task 2d (parallelizable)
   ✓ UI feature verification passes

4️⃣ Wave 3 (2-3h, independent)
   Task 3a (independent)
   ✓ preloading_tricks issue resolved or documented
```

### Commit Strategy

| Phase | Tasks | Example PR Title | Dependency | Parallel |
|------|------|-----------|------|------|
| 1 | 1a+1b | `feat: support +separator version format` | none | no |
| 2a | 2a+2b | `feat: support 4-segment version numbers` | PR1 | yes |
| 2c | 2c | `feat: add version template dropdown UI` | PR1 | yes |
| 2d | 2d | `feat: add custom regex version input` | PR2c | yes |
| 3 | 3a | `fix: resolve preloading_tricks issue` | none | yes |

### Total Time Estimate

| Phase | Tasks | Unit Tests | Integration Tests | UI Tests | Time |
|------|--------|--------|--------|--------|------|
| Wave 1 | 2 | 13 | 5 | — | 3h |
| Wave 2a/2b | 2 | 10 | 4 | — | 2h |
| Wave 2c | 1 | 6 | 3 | 5 | 3h |
| Wave 2d | 1 | 8 | 4 | 6 | 4h |
| Wave 3 | 1 | — | — | — | 2-3h |
| **Total** | **7** | **37** | **16** | **11** | **14-15h** |

---

## Success Checklist

### ✅ Functional Completeness
- [ ] Wave 1: Task 1a completed and all tests pass
- [ ] Wave 1: Task 1b completed and all tests pass
- [ ] Wave 2a: Task 2a completed and all tests pass
- [ ] Wave 2b: Task 2b completed and all tests pass
- [ ] Wave 2c: Task 2c completed and all tests pass
- [ ] Wave 2d: Task 2d completed and all tests pass
- [ ] All 6 formats in support matrix parse correctly
- [ ] UI dropdown correctly displays 4+ preset templates
- [ ] Users can add and use custom regex templates

### ✅ Code Quality
- [ ] No new regressions introduced by fixes
- [ ] Code changes pass linter and formatter checks
- [ ] New regex and logic changes have clear comments and docs
- [ ] Variable and function names follow style conventions

### ✅ Documentation and Communication
- [ ] Completion status of each task is updated in the plan
- [ ] Key decisions and deviations are recorded
- [ ] Final fix summary is generated
- [ ] Team is informed of fix scope and acceptance criteria

---

## Decision Addendum (2026-05-09)

- English scope: all user-facing runtime text
- Plan migration scope: active plan + FIX_PLAN*.md, migrated to plans/<plan_id>/
- Version template area: compact layout with a concise how-to entry

---

## Related Documents

- [Fix plan summary](FIX_PLAN_SUMMARY_UPDATED.md) - one-page summary
- [Problem analysis](problem_analysis.md) - detailed root cause analysis  
- [Version support matrix](#wave-1-required-fixes-l1---critical) - acceptance criteria

**Last Updated**: May 9, 2026
