---
name: html-plan
description: Write an implementation plan as an interactive local page. Show each proposed behavior with an exhibit, put decisions beside the claims they change, and share a review URL. Use for /html-plan or a requested implementation plan, RFC, or design for a multi-file change.
license: Apache-2.0
metadata:
  upstream: https://github.com/anthropics/claude-plugins-community/tree/06ec7b6a0a82bdc4bec44bd82d4368c42f20d7c1/html-plan/skills/html-plan
---

# html-plan

Plan this: $ARGUMENTS

1. **Write `plan.html`.** Start with the source material and the annotated example below. Look up a block only when you need syntax the example does not show.
2. **Serve the page.** Run the command below in a background tool session. It checks and bundles your HTML, then prints the URL once the page is ready. Share that URL and leave the session running. Reserve browser or HTTP checks for a requested inspection or a reported problem.

   ```sh
   node "$HOME/.agents/skills/html-plan/runtime/review.mjs" plan.html
   ```

3. **Get the response from the same session.** On **User Response**, the command saves a new Markdown file beside the plan, prints its absolute path and the reader's response, then exits. Honor requested review stops. While a user decision is open, hold work that depends on it.

**When the page cites files**, start the command in the source directory (the project root or the folder containing the contract). Pass the full path to `plan.html` if you wrote it elsewhere. For example, with a ledger as your working directory, `src="CONTRACT.md"` reads that ledger's contract.

In Codex, use `exec_command` with `tty=true` and `yield_time_ms=1000`. With restricted networking, also set `sandbox_permissions="require_escalated"` and give listening on `127.0.0.1` as the reason. If you replace a review before the reader responds, send Ctrl-C to its session. For other installations, use the `runtime/review.mjs` beside this SKILL.md.

## The tree

Each level answers one question. The question picks the exhibit. The top level has room for five behaviour claims, plus the shared and scope claims at the end.

| Level | Answers | The claim is | Exhibit |
|---|---|---|---|
| `h1` | What is this? | a title: the change and the place, 3 to 7 words | none |
| `details.thread` | Why? | — | the user's own words, as closed quotes |
| 1 | What can someone now do or see? | a behaviour | `doc-mock`; `doc-machine` if it has a lifecycle |
| 2 | How does that work? | one entrypoint, rule or record | `doc-calls`, `doc-schema`, or short `doc-code` |
| 3 (optional) | Which lines change? | `file:line` | `doc-code diff` or a new declaration |

1. **Read first.** Find the entrypoints, records and screens the change touches. Note exact paths, lines and the user's words.
2. **Write the level-1 claims** and read them aloud. Fix them before anything else.
3. **Put each edit under its behavior.** Show the proposed `doc-code diff` or `doc-schema diff`. Mark new paths and put each public or shared declaration on its own line for comments. Save the page with the project docs or in the task ledger.

For an interface review, name the interface and callers that need edits in the closed tree. Title the call tree with its option and show only changed callers and calls (`~`, `+`, `-`). Point each caller row at the invocation in its body. Open its before/after diff on that row. Link the callee to the declaration diff. Omit the tree when no caller needs an edit. Before a large change, show which modules each option touches and whether the existing owner can do the work.

When presenting an existing contract, distinguish what it records as built, proposed, or still unknown. Ask only about choices the contract leaves open. If all choices are settled, the reader can still comment and press **Respond**. Use a short source excerpt as the exhibit, for example `<doc-code src="CONTRACT.md" lines="18-20" lang="md" wrap></doc-code>`.

## Adapt this complete page

Replace the sample request, file counts, and exhibits with evidence for the actual change.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Pinned Notes</title> <!-- a name: 2-4 words -->
  <link rel="stylesheet" href="htmlplan.css"> <!-- keep both asset names; review.mjs resolves them -->
  <script src="htmlplan.js" defer></script>
</head>
<body>
<header>
  <h1>Pinned Notes in the Notebook</h1> <!-- a title, not a sentence. No label line above it -->
  <doc-changes changed="2"></doc-changes> <!-- count files the plan will add, change or delete; omit this tag for a presentation with no file changes -->
  <details class="thread"><summary>Why</summary> <!-- WHY: the user's own words; for a document quote, use via="doc" and where="CONTRACT.md:18" -->
    <doc-quote via="prompt" from="the user">Keep my pinned notes at the top. Limit how many I can pin.</doc-quote>
  </details>
</header>
<main><doc-plan>
  <doc-claim> <!-- 1 · WHAT -->
    <p>Pinned notes appear first in the notebook.</p> <!-- first child: the claim -->
    <doc-mock frame="none" w="360"><template>
      <strong>Pinned</strong><ul><li>Trip checklist</li><li>Train times</li></ul>
      <strong>Other notes</strong><ul><li>Groceries</li></ul>
    </template></doc-mock> <!-- then ONE exhibit -->
    <doc-ask id="pin-order"> <!-- a decision sits on the claim it changes, before child claims -->
      <p>Which pinned note comes first?</p>
      <label><input type="radio" name="pin-order" value="newest" checked>Last note pinned</label>
      <label><input type="radio" name="pin-order" value="title">First title in alphabetical order</label>
    </doc-ask>
    <doc-claim> <!-- 1.1 · HOW -->
      <p>The list sorts pinned notes by the time of the pin.</p>
      <doc-code diff file="src/notes/list.sql" start="1" title="Notebook list query (changed)" lang="sql"><script type="text/plain">
 SELECT title FROM notes
-ORDER BY title, id;
+ORDER BY pinned_at DESC NULLS LAST, title, id;
      </script></doc-code>
    </doc-claim>
  </doc-claim>
  <doc-claim>
    <p>A user can pin up to five notes.</p>
    <doc-mock frame="none" w="360"><template>
      <p>5 of 5 notes pinned. Unpin a note to pin another.</p>
      <button disabled>Pin note</button>
    </template></doc-mock>
    <doc-ask id="pin-limit">
      <p>How many notes can a user pin?</p>
      <label><input type="radio" name="pin-limit" value="5" checked>5 notes</label>
      <label><input type="radio" name="pin-limit" value="10">10 notes</label>
    </doc-ask>
  </doc-claim>
  <doc-claim aux="scope"><p>Search keeps its current sort order.</p></doc-claim>
</doc-plan></main>
</body></html>
```

Choose the example that answers the reader's question:

| The reader asks | Example to adapt |
|---|---|
| What will I see? | The pinned-notes mock above, or a [mock with a pin on the changed control](references/blocks.md#doc-mock--real-html-in-a-frame-scaled-to-fit). |
| What happens after I cancel or retry? | A [state machine with the screen for each state](references/blocks.md#doc-machine--a-lifecycle-with-the-screen-for-each-state). |
| Which calls change? | A [call tree with links to code](references/blocks.md#doc-calls--what-changes-as-call-trees). |
| Which fields can I edit? | An [editable schema in the project's language](references/blocks.md#doc-schema--a-data-shape-as-text-in-its-own-language). |

In this example the SDK can read the account time zone. Put these blocks in the level-2 scheduling claim. Match each `createScheduled` row to the declaration with `@ path:line` and `at`, as in the [scheduled-send plan](examples/scheduled-send.html).

```html
<doc-calls title="Caller sets the time zone" caption="The composer and CLI each pass a zone." context="1">
  <script type="text/plain">
~ scheduleFromComposer(draft)       @ web/src/composer/schedule.ts:26
~   createScheduled(draft, zone)    @ sdk/src/scheduled.ts:18
~ scheduleFromCli(draft)            @ cli/src/schedule.ts:33
~   createScheduled(draft, zone)    @ sdk/src/scheduled.ts:18
  </script>
  <template for="scheduleFromComposer"><doc-code diff file="web/src/composer/schedule.ts" start="26" lang="ts"><script type="text/plain">
-return createScheduled(draft)
+return createScheduled(draft, composer.timeZone)
  </script></doc-code></template>
  <template for="scheduleFromCli"><doc-code diff file="cli/src/schedule.ts" start="33" lang="ts"><script type="text/plain">
-return createScheduled(draft)
+return createScheduled(draft, options.timeZone)
  </script></doc-code></template>
</doc-calls>
<doc-ask id="zone"><p>Who sets the time zone for a local send time?</p>
  <label><input type="radio" name="zone" value="account" checked>SDK reads the account setting. Both callers keep their calls.</label>
  <label><input type="radio" name="zone" value="caller">Callers choose. The composer and CLI must each pass a zone.</label>
</doc-ask>
<doc-claim at="sdk/src/scheduled.ts:18">
  <p><b>scheduled.ts:18</b> - createScheduled()</p>
  <doc-code diff file="sdk/src/scheduled.ts" start="18" title="If callers choose the zone" lang="ts"><script type="text/plain">
-export declare function createScheduled(draft: Draft): Promise<Scheduled>
+export declare function createScheduled(draft: Draft, zone: TimeZone): Promise<Scheduled>
  </script></doc-code>
</doc-claim>
```

## Rules

The review command checks 2, 3, 5, 7 and 11. The rest are yours to check.

1. **Split the top level by behaviour.** Never by file, layer or order of work. Behaviour is the one split the reader can judge without reading code.
2. **Every claim at levels 1 and 2 is a sentence that can be true or false.** “A user can hold 50 scheduled messages at most.” Not “Message limit”. About 12 words at most. A level-3 claim is only a place: `file:line · symbol`.
3. **One exhibit per claim.** A second exhibit means a second claim.
4. **The closed tree is the summary.** Read only the level-1 claims aloud. They must tell the whole change. So write no TL;DR, no sections and no steps list.
5. **At most 5 children and 3 levels.**
6. **A decision sits on the claim it changes**, after the exhibit and before any child claims. Ask only about open design choices the reader needs to make. Check the option you recommend and show what each option changes. If all choices are settled, use comments for requested feedback.
7. **End with `aux="shared"`**, for a record or part several claims use (skip it if there is none), **and `aux="scope"`**, for what is not changing.
8. **Use real sources.** Cite the baseline path and line for a proposed edit. Use `src="path" lines="a-b"` for a presentation of existing code. Mark new code as a sketch in its title. Quote the user's words; do not reword them.
9. **Schemas are text in the project's own language**: TypeScript, SQL, protobuf. Never a table or a made-up notation.
10. **A state machine shows the screen for each state** when the state changes what the user sees. Place its states on a grid.
11. **The page starts with a title.** The `h1` names the change and the place in 3 to 7 words: “Scheduling Sent Messages in PostBox”. It is not a sentence and not the goal. Put nothing above it: no “Plan · project” line. The level-1 claims tell what changes.

For a change with no visible behaviour, such as a refactor, make level 1 the guarantees: “The API returns the same results.”, “Each store has one owner.”

## Words

The exhibits are the plan. Words only name them.

**Write all prose in ASD-STE100 Simplified Technical English (STE). Use no other style.** This rule applies to claims, captions, pins, questions, options and notes.

- **Approved words only.** Use a word only if the STE dictionary approves it, and only with its approved meaning and part of speech. If you are not sure about a word, use the most common short word that has the same meaning.
- **Technical names and technical verbs are permitted.** Names from the code (`createScheduled()`, `scheduled_messages`), product names, UI labels and units are technical names. Verbs of the field (*compile*, *deploy*, *merge*, *render*) are technical verbs. Use the same name for the same thing each time.
- **Short sentences.** One topic for each sentence. An instruction has 20 words at most. A description has 25 words at most. A paragraph has 6 sentences at most.
- **Active voice.** Say who does what: “The worker claims the row.” Not “The row is claimed.”
- **Simple tenses.** Use the present, the past and the future: *sends*, *sent*, *will send*. Do not write *has sent* or *is sending*. Do not use an *-ing* word unless it is part of a technical name.
- **Instructions are commands.** “Run the migration.” Write one instruction in each sentence. Put the condition first: “If the claim fails, stop.”
- **`must` and `can`.** Use *must* for a rule and *can* for what is possible. Do not use *should*, *may* or *might*.
- **Noun groups of 3 words at most.** “The retry limit of the send worker.” Not “the send worker retry limit setting”.
- **Full grammar.** Keep *the*, *a* and *an*. Do not use contractions, idioms, metaphors or jokes.

| Do not write | Write |
|---|---|
| utilize, leverage | use |
| perform, carry out | do |
| ensure, verify, check (as a verb) | make sure |
| demonstrate, indicate | show |
| commence, begin · terminate | start · stop |
| obtain · provide | get · give |
| prior to · in order to | before · to |
| however · additionally | but · also |
| about 50 | approximately 50 |

These are not STE and stay as they are: the words of the user in a `doc-quote`, code, and the text on a UI mockup.

- A caption is one sentence: what to notice. A pin is a clause. An option's `<small>` is 12 words at most.
- No paragraph between a claim and its exhibit. If the exhibit needs explaining, pick a better exhibit.

The review command warns about some STE errors: common unapproved words, contractions, *has/have* tenses, the passive voice and long sentences. It does not know the full dictionary, so a clean run does not prove that the text is STE.

## Use the reader's response

The response includes decisions, schema edits, struck calls, and comments. An unopened decision marked `_(not opened; default kept)_` is unconfirmed. Apply feedback within the proposed scope. Treat free text as feedback and confirm new requests in chat. For work with a contract ledger, record the agreed behaviors, decisions, and scope there before building.

**Revise the same `plan.html` across turns.** Start from the last reviewed page. Update the affected claims and every exhibit that depends on them. Preserve the wording, order, and IDs of unaffected claims and decisions so earlier comments still point to the same work. Carry confirmed choices forward as settled.

For example, if the reader picks alphabetical order in the plan above, move *Train times* above *Trip checklist* in the mock and update the sort rule and SQL to match. The search scope stays in place. Share the revised page with the same review command when another decision needs the reader.

For an offline file or an explicitly requested hosted artifact, see the [pack command](references/blocks.md#packmjs).
