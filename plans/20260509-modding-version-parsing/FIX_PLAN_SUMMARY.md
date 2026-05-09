# Fix Plan Execution Summary

**Created**: May 9, 2026  
**Project**: Minecraft Mod Version Parsing  
**Plan Status**: ✅ Generated and ready for implementation

---

## 📊 One-page Summary

### Problem Statement

The current version parsing system cannot correctly handle:
- ❌ `+`-separated version formats (for example, `0.7.6+1.21+neoforge`)
- ❌ Four-segment version numbers (for example, `26.1.2.4`)
- ❌ Mixed loader/MC version suffixes (for example, `20.2.15-fabric,1.20.1`)

### Fix Strategy (3 Waves, 5 Tasks)

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
│ WAVE 2: L2 Important (Depends on Wave 1)           │
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
| 2 | `26.1.2.4-fabric` | bookshelf-lib | Correctly recognize 4-segment version | 2 |
| 3 | `20.2.15-fabric,1.20.1` | bookshelf-lib | Mixed loader+MC format | 2 |
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
| [src/repos.ts](src/repos.ts) | 3a | TBD | To be determined after investigation |

### Time Estimate

| Wave | Task Count | Total Time | Critical Path |
|------|--------|--------|---------|
| 1 | 2 | 3h | 🔴 Blocking path |
| 2 | 2 | 2h | Depends on Wave 1 |
| 3 | 1 | 2-3h | Independent, can run later |
| **Total** | **5** | **7-8h** | **3-4h** (critical path) |

### Success Criteria

- ✅ Both Wave 1 tasks completed and tested
- ✅ Both Wave 2 tasks completed and tested
- ✅ All 6 target formats parse correctly
- ✅ No new regressions (existing formats remain compatible)
- ✅ All code passes linter checks
- ✅ Key regex changes have clear comments

---

## 🎯 Quick Start

### Read the full plan

👉 Open: [FIX_PLAN.md](FIX_PLAN.md)

Includes:
- Detailed acceptance criteria for each task
- Concrete implementation guidance
- Parameterized unit test cases
- Integration and regression testing strategy
- Risk assessment and mitigation

### Checkpoints (Go/No-Go)

| Checkpoint | Completion Signal | Owner |
|--------|---------|------|
| Wave 1 complete | + separator versions parse correctly | @dev-1a, @dev-1b |
| Wave 2 start | Wave 1 acceptance passes | @qa |
| Wave 2 complete | 4-segment format support complete | @dev-2a, @dev-2b |
| Wave 3 start | Optional investigation approved | @dev-3a |

### Key Decision Points

**Q1: How should `+` separator priority be handled?**  
→ A: Prefer the last `-`, then fallback to the last `+`.

**Q2: What is the max version segment count?**  
→ A: Four segments (supports `1.2.3.4`).

**Q3: How to treat single number tokens in versions (for example, `238222`)?**  
→ A: Do not treat as version format (avoid false matches).

**Q4: How is English scope defined?**  
→ A: Limited to all user-facing runtime text.

**Q5: What is the plan migration scope?**  
→ A: active plan + FIX_PLAN*.md, moved into plans/<plan_id>/.

**Q6: How should the version-template area be adjusted?**  
→ A: Use a compact layout and provide a concise how-to entry.

---

## 📝 Related Documents

- [Problem analysis](problem_analysis.md) - detailed root cause analysis
- [Full fix plan](FIX_PLAN.md) - complete task details
- [Version support matrix](#validation-targets-support-matrix) - acceptance criteria

---

## 📋 Suggested Task Assignment

**Recommended split**:
- **1a + 1b**: same developer (strongly coupled format logic)
- **2a + 2b**: same developer (both are regex updates)
- **3a**: separate assignee or parallel lane (independent investigation)

**Skills required**:
- Regex: ⭐⭐⭐ (Wave 1, 2)
- TypeScript: ⭐⭐ (Wave 1, 2)
- System investigation: ⭐⭐⭐ (Wave 3)

---

**👉 Ready to start? Open [FIX_PLAN.md](FIX_PLAN.md) for all details.**
