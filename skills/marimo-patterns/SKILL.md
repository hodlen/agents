---
name: marimo-patterns
description: Python-to-Marimo mapping, setup, reload-free data/view separation, view routing, verification, and caveats for Marimo notebooks. Use alongside python-patterns.
---

# Marimo Notebook Patterns

Write a Marimo notebook like a Python module: shared imports and constants in `with app.setup:`, and named `@app.cell` functions that wire reactive state.
Keep data loading apart from view controls, so searching, filtering, or grouping never reloads a source.
Verify with `marimo check --strict`, a script run, and named-cell runs of non-default states.
[`references/example.py`](references/example.py) is a complete notebook that follows these rules.

## Map Python constructs to Marimo

| Python construct | When to use | Marimo form |
| --- | --- | --- |
| Module imports and shared constants | Referenced by 2+ cells or top-level defs | `with app.setup:` at the top of the file using public (unprefixed) names; keep single-cell constants in their cell |
| Simple expression | 1-2 step transform in one cell | Inline comprehension, `dict_a \| dict_b`, or `.pipe(...)` inside `@app.cell` |
| Closure | Loop or 3+ steps in one cell, or binding cell state | `def _fn():` inside `@app.cell` with plain local names (no `_`), or `def matching_rows(df):` returned from a filter cell |
| File-local function or class | Stateless logic called by 2+ cells or unit-tested in a standalone app | `@app.function` or `@app.class_definition` with explicit parameters, referencing only `app.setup` and earlier top-level defs (`MR003`) |
| Shared / common function | Domain rule, backend dispatch, or cross-notebook logic | Package or common-library function; do not create a one-notebook sidecar module just to cut line count |

Test a single-caller closure through its cell, `cell_name.run(**overrides)`, instead of hoisting it to `@app.function`.

## Keep the reactive graph explicit

- **Define each exported name in exactly one cell (`MB002`) and assign it on every path.** Marimo runs cells by name dependencies, not file order, so return new values instead of mutating upstream objects.
- **Name each cell for the stage it owns, such as `def load_orders(dates):`.** The name documents the graph and lets tests call `notebook.load_orders.run(**overrides)`. Keep cell names unique; see Caveats for setup names.

## Load data once; let view controls work in memory

- **Query inputs reload data; view controls never do.** Query inputs are the date range, entity key, and opt-in load toggles; view controls are search text, multiselect filters, and `By` grouping. Layer the cells:
  1. Query cells read range and key inputs, capture a fresh `as_of` snapshot, and export `(as_of, base_df)`.
  2. Optional-load cells take `(base_df, as_of, toggle)` and return `None` when unchecked. They run before display filters when pool-level rules need unfiltered rows.
  3. Filter cells apply view controls in memory, and separate aggregation cells group the filtered rows into frames named by grain (`daily_orders`).
- **Feed baseline charts and grouped tables from `filtered_base`, not from optional-load outputs.** A failed optional read then leaves the baseline views live.
- **When a chart and a table show the same measure, share one named aggregation** and name its calculation, such as total or average, in both labels.
- **Render each widget in the cell that constructs it,** so a sibling widget edit never reruns the constructor and resets the user's picks. Group repeated filters with `mo.ui.dictionary(options)`, and use `mo.ui.dropdown(dict_options)` to pair `.selected_key` labels with `.value` column names.
- **Let empty frames reach tables and charts, so headers and axes stay visible.** Guard as `python-patterns` says; in addition, `pd.concat([])` raises, so return a typed empty frame, and a text summary may say `"No matching rows."`.

## Route and render views

- **Switch mutually exclusive view modes at one cell boundary that stops with the active view and exports a token for the other mode.** For example, `if grouped: mo.stop(True, grouped_view)`, driven by baseline inputs; do not repeat `mo.stop` checks on the same widget in sibling cells.
- **End each presentation cell with one unconditional top-level expression before `return`,** unless the cell exits early through `mo.stop(cond, view)`.
- **Build charts, tables, and layouts as builder chains:** `alt.Chart(...).mark_area().encode(...)`, `mo.vstack([...])`, `.pipe(...)`. Use `alt.Undefined` and `*([...] if col else [])` for optional parts, and wrap multi-step KPI, pivot, or caption assembly in a `def _build():` closure.
- **Label a default-off control `Feature: definition`.** Show its data-basis note only while the control is on and the active view displays that data.

## Verify execution and reactivity

- **Run `marimo check --strict <notebook.py>` and `python <notebook.py>` in the repository environment.** A script run covers only initial widget values.
- **Exercise non-default data shapes through named cells or `@app.function` calls:** empty results; negative, zero, or missing values; chart-table parity. For example, `out, defs = notebook.aggregate_orders.run(group_by=SimpleNamespace(value="region", selected_key="Region"), filtered_orders=df)`.
- **Import modules, not bare functions, in `app.setup` (`from pkg import store`),** so `patch.object(store, "read_orders", ...)` intercepts calls during `cell.run()` and `app.run()`.
- **When you change lazy gates, view routing, snapshot lifetimes, or optional disclosure, drive real widget events against mocked IO in a scratch script.** Check read counts on default runs, snapshot reuse on opt-in, zero reloads on filter or mode switches (including after an outage), one active view mode that empty results still reach, and disclosure visibility across enable, switch, and disable.

## Caveats

- **`_`-prefixed setup names stay private to `app.setup`, and a cell function named like a setup symbol shadows it (`MarimoMissingRefError`).** `MB004` checks only cell references, so live clocks or clients in `app.setup` pass lint, run on import, and freeze across UI updates.
- **Expressions inside a trailing `if`, `match`, or `try` run without rendering (`MR002`).** Bind one variable and make it the last top-level expression before `return`, or call `mo.stop(cond, fallback)`.
- **Pairs of `$` in `mo.md(...)` parse as LaTeX math unless escaped as `\$` (`MF007`).** Indented multi-line strings in `mo.md(...)` fail strict lint unless triple-quoted and dedented.
- **Put recovery and opt-in controls in independent upstream cells.** A checkbox rendered below a failing filter or optional read cannot be reached to recover.
- **Reserve `mo.state` and `on_click` callbacks for write workflows and editor drafts,** never for derived read-only views.
- **Convert non-JSON columns such as `pandas.Period` to `str` or timestamps before charts and tables.** A script run may skip formatters, but Vega `.to_json()` and live-kernel formatters fail on them.
- **Testing traps:**
  - `app.run(defs={...})` replaces the whole defining cell and raises `IncompleteRefsError` unless every sibling export of that cell is given.
  - Under `cell.run()`, `mo.stop(True, view)` raises `MarimoStopError` carrying `exc.output`.
  - Kernel `UpdateUIElementCommand` runs need `create_default_hooks()` to trigger formatters, list payloads (`["Region"]` or `[]`) for `dropdown` and `multiselect`, `dict_widget.elements[key]` for `mo.ui.dictionary`, the check `type != "ancestor-stopped"` when reading errors, and context teardown before calling `cell.run()`.
