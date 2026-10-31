---
name: writing
description: "Write durable prose (docs, specs, READMEs, skills, prompts, PR and commit text) so its reader gets the essentials in one minute. Use before writing or rewriting any of them."
---

# Writing

A reader gives a document one minute and reads only its skim path: the title, the opening, headings, the first sentence of each paragraph or item, tables, and code blocks. Put every conclusion on that path.

Before writing, name the reader and the three things they must leave with. Those three things are the opening.

## Rules

1. **The opening works alone.** At most five lines that suffice if the reader stops there. Order the rest by how often the reader needs it, not by how you reasoned.
2. **Headings and first sentences are claims.** Write "Windows are half-open", not "Time handling". The first sentences alone must carry every conclusion; later sentences support them.
3. **State the default, then the exception.** Give the default without qualifiers and put each exception on its own line. Drop "where relevant", "as appropriate", "applicable", "intended", and "when needed"; if a rule applies only sometimes, say when, once.
4. **Show instead of explaining.** One concrete value, command, or case replaces a paragraph of abstraction; an example earns its place when it separates cases the reader could confuse. Compare options in a table, put commands in code blocks, and define a term in one line.
5. **Delete what changes nothing.** For each sentence, ask whether any of the document's readers would act differently without it; if none would, delete it. Judge a skill or reference by all the tasks it serves, not one. This removes restated principles, provenance such as "added by install.py", and the history of the text.
6. **Say it once, at its owner.** Point to the rule instead of restating it.

## Shapes

| Genre | Opening | Then |
| --- | --- | --- |
| README | What it is, what it does, the install or run command | Usage examples, configuration, development |
| Interface doc | What the caller gets and the failures they must handle | Parameters, effects, lifetime, examples of non-obvious use |
| Spec | Contract index: promises, invariants, non-goals | Pitfalls, domain definitions, decisions with reasons |
| Skill or prompt | When it applies, then imperative steps or checks | Exceptions, judgment calls, references |
| Commit | Subject: the change, imperative | Why, what changed, how it was verified |
| PR | Problem, change, evidence: one line each | Risks, follow-ups, where to start reviewing |

## Before and after

Defaults instead of qualifiers:

> Before: Distinguish instants, local times and dates, and event time from processing time where relevant. Define the timezone and interval boundaries that affect comparisons or grouping.
>
> After: **Label each time column as an instant, a local time, or a date, and as event or processing time.** `2026-11-01T03:00Z` is an instant; `2026-11-01 03:00` without a zone is a local time.
> **Compare and group in one stated zone, with half-open windows `[start, end)` unless the contract says otherwise.**

Action instead of provenance:

> Before: Metrics belong to the analyzed worktree in `.metrics/`, excluded through the global Git ignore file by `install.py`. Use reports whose source and analysis inputs match the reviewed code; retained reports are evidence only while those inputs remain applicable.
>
> After: Reports describe the code they ran on; rerun the tools after edits.

The action in the first sentence, not a topic or a slogan:

> Before: **Row meaning and joins.** Establish what a row represents and any required identity or uniqueness.
>
> After: **Check join cardinality and match completeness separately.**

## One-minute test

Give a fresh reviewer only the skim path, the reader, and the reader's top three questions. It answers from that text alone and marks each answer full, partial, or missing. Then it reads the full text and lists sentences that fail rule 5 for every reader of the document. Revise until all three answers are full and the list is empty.
