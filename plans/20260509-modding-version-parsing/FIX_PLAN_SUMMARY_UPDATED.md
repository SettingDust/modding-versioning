# Fix Plan Execution Summary (Updated)

**Created**: May 9, 2026  
**Updated**: May 9, 2026  
**Project**: Minecraft Mod Version Parsing  
**Plan Status**: ✅ Updated with expanded scope (Wave 2 + UI features)

---

## 📊 One-page Summary

### Problem Statement

The current version parsing system cannot correctly handle:
- ❌ `+`-separated version formats (for example, `0.7.6+1.21+neoforge`)
- ❌ Four-segment version numbers (for example, `26.1.2.4`)
- ❌ Mixed loader/MC version suffixes (for example, `20.2.15-fabric,1.20.1`)
- ❌ **Weak UI experience** - users must manually memorize source-specific version formats

### Fix Strategy (4 Waves, 7 Tasks)

```
┌─────────────────────────────────────────────────────┐
│ WAVE 1: L1 Required (Blocking) ⚡                    │
├─────────────────────────────────────────────────────┤
│ Task 1a: detector.ts normalization fix              │
│   → Handle `+`-separated versions; normalize        │
│     `0.7.6+1.21+neoforge` to `0.7.6`               │
│   ⏱ 1h, Complexity⭐⭐                               │
│                                                     │
│ Task 1b: checker.ts context extraction fix          │
│   → Support `+` separator parsing for loader and MC │
│   ⏱ 2h, Complexity⭐⭐⭐                              │
└─────────────────────────────────────────────────────┘
          ↓ (Checkpoint: + separator formats pass)
┌─────────────────────────────────────────────────────┐
│ WAVE 2a/2b: L2 Important (version format support)  │
├─────────────────────────────────────────────────────┤
│ Task 2a: extend version regex (4-segment support)  │
│   → Change `/-\d+\.\d+(\.\d+)?$/` to          │
│     `/-\d+\.\d+(?:\.\d+){0,2}$/`              │
│   ⏱ 1h, Complexity⭐                                │
│                                                     │
│ Task 2b: extend version validation                  │
│   → Recognize 4-segment versions as valid format   │
│   ⏱ 1h, Complexity⭐                                │
└─────────────────────────────────────────────────────┘
          ↓ (Checkpoint: 4-segment versions pass)
┌─────────────────────────────────────────────────────┐
│ WAVE 2c/2d: L2 Important (UI feature expansion)    │
├─────────────────────────────────────────────────────┤
│ Task 2c: UI dropdown implementation                 │
│   → Preset source parsing templates                 │
│     (Maven, Modrinth, Fabric)                       │
│   → Supports 4+ templates for quick selection       │
│   ⏱ 3h, Complexity⭐⭐                               │
│                                                     │
│ Task 2d: custom regex input                         │
│   → Allow user-defined version formats              │
│   → Real-time validation, testing, local save       │
│   ⏱ 4h, Complexity⭐⭐⭐                              │
└─────────────────────────────────────────────────────┘
          ↓ (Checkpoint: all formats + UI pass)
┌─────────────────────────────────────────────────────┐
│ WAVE 3: L3 Investigation (Optional) 🔍              │
├─────────────────────────────────────────────────────┤
│ Task 3a: preloading_tricks repository lookup        │
│   → Confirm source and either fix or document       │
│   ⏱ 2-3h, Complexity⭐⭐⭐                            │
└─────────────────────────────────────────────────────┘
```

### Validation Targets (Support Matrix)

After the fix, the following 6 version formats should parse correctly:

| # | Format | Source | Expected Behavior | Wave |
|----|------|------|---------|------|
| 1 | `0.7.6+1.21+neoforge` | fzzy_config | MC=1.21, loader=neoforge | 1 |
| 2 | `26.1.2.4-fabric` | bookshelf-lib | Correctly recognize 4-segment version | 2a/2b |
| 3 | `20.2.15-fabric,1.20.1` | bookshelf-lib | Mixed loader+MC format | 2a/2b |
| 4 | `1.2.0-fabric` | Modrinth Maven | Existing format remains compatible | ✓ |
| 5 | `3.0.9-fabric,1.20.2` | Modrinth Maven | Existing format remains compatible | ✓ |
| 6 | `mc1.21.1-0.6.0+build.24` | Modrinth Maven | Existing format remains compatible | ✓ |

### Key File Change List

| File | Task | Lines | Change Type |
|------|------|------|---------|
| [src/detector.ts](src/detector.ts) | 1a | L125 | Regex extension (version normalization) |
| [src/detector.ts](src/detector.ts) | 2a | L32-38 | Regex extension (suffix stripping) |
| [src/checker.ts](src/checker.ts) | 1b | L110-140 | Logic extension (version filtering) |
| [src/checker.ts](src/checker.ts) | 2b | L28-29, 101-103 | Constant extraction + usage |
| [src/types.ts](src/types.ts) | 2c/2d | NEW | UI template config and validation |
| [src/dashboard.tsx](src/dashboard.tsx) | 2c/2d | NEW | Dropdown and custom-input UI |
| [src/repos.ts](src/repos.ts) | 3a | TBD | To be determined after investigation |

### Time Estimate

| Wave | Task Count | Total Time | Parallel | Critical Path |
|------|--------|--------|--------|---------|
| 1 | 2 | 3h | No | 🔴 Blocking |
| 2a/2b | 2 | 2h | Partial | 🟡 Depends on W1 |
| 2c/2d | 2 | 7h | **Yes** | 🟢 Independent |
| 3 | 1 | 2-3h | **Yes** | 🟢 Independent |
| **Total** | **7** | **14-15h** | — | **3-5h** (critical) |

### Success Criteria

- ✅ Both Wave 1 tasks completed and tested
- ✅ Both Wave 2a/2b tasks completed and tested
- ✅ Both Wave 2c/2d tasks completed and tested
- ✅ All 6 target formats parse correctly
- ✅ **UI dropdown correctly displays 4+ preset templates**
- ✅ **Users can add and use custom regex templates**
- ✅ No new regressions (existing formats remain compatible)
- ✅ All code passes linter checks
- ✅ Key regex changes have clear comments

---

## 🎯 Quick Start

### Recommended Execution Steps

1. **Stage 1 (3h - Required)**
   ```
   Task 1a → Task 1b (sequential, dependent)
   Verification: + separator formats pass all tests
   ```

2. **Stage 2a (2h - Base format support)**
   ```
   Task 2a → Task 2b (can be parallelized)
   Verification: 4-segment versions pass all tests
   ```

3. **Stage 2c (3h - Base UI)** or **Stage 2d (4h - extension)**
   ```
   Task 2c [parallelizable with 2a/2b]
   Verification: dropdown shows presets and supports selection

   Task 2d [parallelizable with 2a/2b]
   Verification: users can input custom regex and save
   ```

4. **Stage 3 (2-3h - Optional)**
   ```
   Task 3a [independent]
   Verification: preloading_tricks issue solved or documented
   ```

### Commit Strategy

| Stage | Tasks | PR Title | Dependency |
|------|------|--------|------|
| 1 | 1a+1b | `feat: support +separator version format` | none |
| 2a | 2a+2b | `feat: support 4-segment version numbers` | PR1 |
| 2c | 2c | `feat: add version template dropdown UI` | PR1 |
| 2d | 2d | `feat: add custom regex version format input` | PR2c |
| 3 | 3a | `fix: resolve preloading_tricks repository issue` | none |

---

## 📋 Wave 2c: UI Dropdown - Key Requirements

### Requirement Overview

Provide a one-click source template picker for version format selection.

### Preset Template Configuration

```typescript
// Defined in src/types.ts
interface VersionTemplate {
  id: string              // "maven" | "modrinth" | "fabric" | "forge"
  label: string           // "Maven Repository" | "Modrinth" etc.
  source: string          // source identifier
  description: string     // format description: "Uses + separated format..."
  regex: string           // validation regex
  examples: string[]      // examples: ["0.7.6+1.21+neoforge", ...]
  separators: string[]    // ['+', '-'] | ['-', ','] etc.
  features: {
    loaderSupport: boolean      // supports loader
    mcVersionSupport: boolean   // supports MC version
    buildMetadata: boolean      // supports +build.24
    multiSegmentVersion: boolean // supports 4-segment versions
  }
}

// At least 4 presets
const VERSION_TEMPLATES = {
  maven: { ... },          // 0.7.6+1.21+neoforge
  modrinth: { ... },       // 26.1.2.4-fabric
  fabric: { ... },         // 1.20.1
  forge: { ... }           // 1.20.1-47.4.4
}
```

### UI Placement and Interaction

```
Dashboard version-check area:

Source template: [Maven ▼]          ← Task 2c dropdown

Template description: Uses + separator...
Example versions:
  - 0.7.6+1.21+neoforge  [Copy]
  - mc1.21.1-0.6.0+build.24 [Copy]

[Custom...]                        ← jumps to Task 2d
```

### Acceptance Criteria (AC)

- ✓ Dropdown displays 4+ preset templates
- ✓ Selecting a template updates description and examples
- ✓ Sample versions can be copied to input with one click
- ✓ Last dropdown item links to custom area
- ✓ Presets are stored in types.ts for easy extension

---

## 📋 Wave 2d: Custom Regex Input - Key Requirements

### Requirement Overview

Support user-defined version regex for new or special source formats, persisted locally.

### Custom Configuration Storage

```typescript
// src/types.ts
interface CustomVersionTemplate extends VersionTemplate {
  id: string              // UUID
  isCustom: boolean       // true
  createdAt: Date
  updatedAt: Date
}

// localStorage shape
{
  custom_templates: [
    { id: "uuid-1", label: "Special Format", regex: "...", ... },
    { id: "uuid-2", label: "...", regex: "...", ... }
  ],
  last_used_template?: "uuid-1"
}
```

### UI Placement and Interaction

```
Dashboard custom area (collapsible):

Format name: [Special Source v2 _____________]
Regex: [^\\d+\\.\\d+\\.\\d+$ ________________]
Description: [Supports 3-segment versions ______________]

Test input: [1.2.3 _________]  [Test] ✓ Match

[Save]  [Cancel]

Saved formats:
├─ Special Source v2 (ID: uuid-1)
│  [Edit]  [Delete]  [Use]
└─ ...
```

### Acceptance Criteria (AC)

- ✓ Users can input name, regex, and description
- ✓ Regex validity is validated in real time
- ✓ Test function shows match result
- ✓ Saved formats persist to localStorage
- ✓ Saved formats appear in Task 2c dropdown
- ✓ Users can edit/delete saved formats
- ✓ Supports at least 5 concurrent custom formats

---

## 🧪 Testing Strategy Summary

### Unit Tests (37 cases)

| Task | Test Area | Cases |
|------|------|-------|
| 1a | version normalization regex | 8 |
| 1b | version filter parsing | 5 |
| 2a | version suffix stripping | 5 |
| 2b | version format validation | 5 |
| 2c | template configuration data | 6 |
| 2d | custom template validation | 8 |
| **Total** | — | **37** |

### Integration Tests (16 cases)

- Wave 1: real version lookup (5 cases)
- Wave 2a/2b: end-to-end version detection (5 cases)
- Wave 2c/2d: UI and detection flow integration (6 cases)

### UI Test Flows (11 flows)

| Task | UI Flow | Count |
|------|--------|-------|
| 2c | select template → show examples → copy | 3 |
| 2c | switch across templates | 2 |
| 2d | input regex → test → save | 3 |
| 2d | edit/delete custom formats | 3 |

---

## 🎯 Key Decisions

### 1. Template storage strategy
- **Decision**: Presets in types.ts; custom templates in localStorage
- **Reason**: Presets are release-managed; custom templates are user-driven

### 2. Custom regex application
- **Decision**: Check user-selected template in detector.ts and apply dynamically
- **Reason**: Avoid altering built-in source detection logic; reduce risk

### 3. Validation strategy
- **Decision**: Real-time regex validation + sample matching checks
- **Reason**: Better UX and less manual testing by users

### 4. English scope
- **Decision**: all user-facing runtime text
- **Reason**: Keep runtime experience consistent; do not expand to non-runtime docs

### 5. Plan migration scope
- **Decision**: migrate active plan + FIX_PLAN*.md to plans/<plan_id>/
- **Reason**: Centralize planning assets and reduce root-level noise

### 6. Version-template section presentation
- **Decision**: compact template section + concise how-to entry
- **Reason**: Shorten cognitive path and improve template-selection onboarding

---

## 📞 Docs & Communication

- Detailed plan: [FIX_PLAN.md](FIX_PLAN.md)
- Problem analysis: [/memories/session/problem_analysis.md](/memories/session/problem_analysis.md)

Each task includes:
- ✓ Acceptance criteria (AC)
- ✓ Key code-change points
- ✓ Detailed testing strategy
- ✓ Implementation suggestions
