---
name: simplify
description: "Improve changed code through reuse, simplification, efficiency, and ownership review, then apply behavior-preserving fixes."
---

# Simplify

Review quality; material defects belong to `/code-review`.

Target: the argument if given, else `git diff @{upstream}...HEAD` plus `git diff HEAD` to cover committed and uncommitted changes, falling back to `git diff main...HEAD`.

## Phase 1: Review (4 angles)

Run both tools from the worktree root, then give their reports to the reviewer.

```sh
crapper --changed-since <ref> --coverage-command '<project coverage command>'  # or --no-coverage
dryer                                                                          # whole tree, so unchanged code can match
```

- `<ref>` is the ref target, else `@{upstream}`, else `main`. Pass path targets as paths instead of `--changed-since`.
- If every function shows 0% coverage, fix the coverage command or record the gap; a zero exit does not prove coverage, and the command may have written where crapper does not read (`crapper --help`). A missing tool is a gap too.
- Reports in `.metrics/` describe the code they ran on. Rerun after edits, and keep in the task directory only what resumption or acceptance needs.
- CRAP above 10 asks whether a promised behavior lacks a test or one function mixes decisions; never split, extract, or add tests only to move the score. Case dispatch can stay, with its reason. A dryer pair involving the target feeds Reuse and the third-occurrence rule.

Use one fresh reviewer for all four angles. Without agents, cover all four angles yourself. Split across agents only when the diff exceeds about 300 changed lines and spans independent modules. Give the reviewer the diff, authorized scope, explicit constraints, accepted decisions and their reasons, and ledger paths with applicable sections (see `Agent ledgers`) if present. Verify conclusions independently. Review user edits, including deletions, as the current design. Each finding names the file, line, issue, concrete cost, and existing or simpler alternative.

### Reuse

Find reimplemented behavior in adjacent and shared modules; name the facility to reuse and separate its guarantees from unrelated architecture.

### Simplification

Find redundant state, duplicate logic, deep nesting, dead code, and unnecessarily broad visibility. Judge simplification by total production-path cost, including conversions, validation, and caller effort; preserve contracted capabilities.

### Efficiency

Find repeated computation or IO, sequential independent operations, blocking startup or hot-path work, and closures retaining unnecessary long-lived state.

### Altitude

Find special cases whose invariant belongs in a shared mechanism; keep the fix at its owning boundary. When that mechanism lies outside authorized scope, report a follow-up instead of relocating. Check that replacing outer implementations under unchanged contracts leaves inner code and explanations valid; relocate violations.

## Phase 2: Apply the fixes

Deduplicate findings by mechanism and apply them directly; delegate to clean agents with non-overlapping scopes only under the same large-diff condition, then check the combined diff without reimplementing accepted fixes. Preserve intentional stubs and required review boundaries. Skip false positives and fixes that change behavior or exceed authorized scope; report skipped scope findings as follow-ups. Re-read before editing; review later user edits as new code. Report fixes and skips briefly.
