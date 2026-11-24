---
name: marimo-patterns
description: Python-to-Marimo mapping, setup, reload-free data/view separation, view routing, verification, and caveats for Marimo notebooks. Use alongside python-patterns.
---

# Marimo Notebook Patterns

Structure a Marimo file like a Python module whose named `@app.cell` functions wire reactive state and views. Put shared imports and multi-cell constants in `with app.setup:` so cell parameter lists name only reactive data and UI dependencies.
Separate data cells from view controls and display cells so filter, search, or grouping edits never reload data sources and data frames stay named by grain.
Let typed empty frames flow through tables and charts, route each view-mode switch at one cell boundary, and verify default runs, non-default states, and real widget transitions.

## Map Python constructs to Marimo

| Python construct | When to use | Marimo form |
| --- | --- | --- |
| Module imports and shared constants | Referenced by 2+ cells or top-level defs | `with app.setup:` at the top of the file using public (unprefixed) names; keep single-cell constants in their cell |
| Simple expression | 1-2 step transform in one cell | Inline comprehension, `dict_a \| dict_b`, or `.pipe(...)` inside `@app.cell` |
| Closure | Loop or 3+ steps in one cell, or binding cell state | `def _fn():` inside `@app.cell` with plain local names (no `_`), or `def matching_rows(df):` returned from a filter cell |
| File-local function or class | Stateless logic called by 2+ cells or unit-tested in a standalone app | `@app.function` or `@app.class_definition` with explicit parameters, referencing only `app.setup` and earlier top-level defs (`MR003`) |
| Shared / common function | Domain rule, backend dispatch, or cross-notebook logic | Package or common-library function; do not create a one-notebook sidecar module just to cut line count |

Do not hoist a single-caller cell closure to `@app.function` just to test it; call the named cell with `cell_name.run(**overrides)` instead.

## Separate data loading, view controls, and display

- Execute cells by name dependencies rather than file order: define each exported name in one cell (`MB002`), assign every returned name on all paths, and return new values instead of mutating upstream objects across cells.
- Name `@app.cell` functions for the stage they own (`def load_orders(dates):`) to document the graph and expose `notebook.load_orders.run(**overrides)` for tests; keep each cell function name unique and distinct from `with app.setup:` symbols.
- Split query inputs (date range, entity key, opt-in load toggle) from view controls (multiselect filters, search text, `By` grouping) so view-control edits filter in memory with zero source reloads:
  1. Query cells read range/key inputs, capture a fresh request snapshot (`as_of`), and export `(as_of, base_df)`.
  2. Optional-load cells take `(base_df, as_of, toggle)`, return `None` when unchecked, and run before display filters when pool-level rules need unfiltered rows.
  3. Filter cells apply search/multiselect inputs in memory, and separate aggregation cells group filtered rows into grain-named series or frames (`daily_orders`).
- Feed baseline charts and grouped tables from `filtered_base` rather than optional-load outputs so an optional read failure leaves baseline views live.
- Share one named aggregation when a chart and a grouped table show the same measure, and state the exact calculation (such as total versus average) in both labels.
- Group repeated filter controls with `mo.ui.dictionary(options)` (and `mo.ui.dropdown(dict_options)` for `.selected_key` labels paired with `.value` column names), rendering each widget in the cell that constructs it so sibling widget edits never rerun the constructor and reset user picks.
- Let valid empty frames reach tables and charts so headers and axes remain visible; guard `.empty` only where an operation raises on empty input (such as `pd.concat([])`, returning a typed empty frame instead) or where a text summary renders `"No matching rows."`
- Route mutually exclusive view modes at one cell boundary (`if grouped: mo.stop(True, grouped_view)`) using baseline inputs, exporting a token for the remaining mode instead of repeating `mo.stop` checks on the same widget across sibling cells.
- Prefer a concise `Feature: definition` label on default-off controls, and render extra data-basis notes only when the control is enabled and the active view displays that optional data.
- Render charts, tables, and layouts as fluent builder chains (`alt.Chart(...).mark_area().encode(...)`, `mo.vstack([...])`, `.pipe(...)`) with `alt.Undefined` and `*([...] if col else [])`, wrapping multi-step KPI, pivot, or caption assembly in a `def _build():` closure.
- End each presentation cell with one unconditional top-level expression before `return`, unless the cell exits early through `mo.stop(cond, view)`.

```python
import marimo

__generated_with = "0.23.2"
app = marimo.App()

with app.setup:
    import datetime as dt
    import altair as alt
    import marimo as mo
    import pandas as pd

    GROUP_COLUMNS = {"Region": "region", "Tier": "tier"}


@app.cell
def controls():
    dates = mo.ui.date_range(
        start=dt.date(2026, 10, 1), stop=dt.date(2026, 10, 21),
        value=(dt.date(2026, 10, 20), dt.date(2026, 10, 21)), label="Range",
    )
    sku_filter = mo.ui.text(label="SKU")
    group_by = mo.ui.dropdown(GROUP_COLUMNS, label="By")
    include_refunds = mo.ui.checkbox(label="Include refunds: gross minus settled refunds")
    mo.hstack([dates, sku_filter, group_by, include_refunds])
    return dates, group_by, include_refunds, sku_filter


@app.cell
def load_orders(dates):
    as_of = dt.datetime.now(dt.UTC)
    start, _ = dates.value
    orders_df = pd.DataFrame([
        {"order_id": "o1", "date": pd.Period(start, "D"), "region": "APAC", "tier": "Pro", "sku": "S1", "usd": 60.0},
        {"order_id": "o2", "date": pd.Period(start, "D"), "region": "EMEA", "tier": "Std", "sku": "S2", "usd": 40.0},
    ])
    return as_of, orders_df


@app.cell
def load_refunds(as_of, include_refunds, orders_df):
    def _net_orders():
        refunds = pd.DataFrame([
            {"order_id": "o1", "refund_usd": 15.0, "settled_at": "2026-10-20T12:00:00+00:00"}
        ])
        if as_of is not None and "settled_at" in refunds:
            refunds = refunds.loc[refunds["settled_at"] <= as_of.isoformat(), ["order_id", "refund_usd"]]
        merged = orders_df.merge(refunds, on="order_id", how="left", validate="1:1", indicator=True)
        unmatched = merged["_merge"].eq("left_only")
        net = merged["usd"] - merged["refund_usd"].where(~unmatched, 0.0)
        return merged.drop(columns="_merge").assign(net_usd=net)

    net_orders_df = _net_orders() if include_refunds.value else None
    return (net_orders_df,)


@app.cell
def filter_orders(orders_df, sku_filter):
    _pat = sku_filter.value.strip()

    def matching_rows(df):
        return df[df["sku"].str.contains(_pat, regex=False, na=False)] if _pat else df

    filtered_orders = matching_rows(orders_df)
    return filtered_orders, matching_rows


@app.cell
def aggregate_orders(filtered_orders, group_by):
    breakdown = group_by.selected_key
    _keys = ["date", group_by.value] if breakdown is not None else ["date"]
    daily_orders = filtered_orders.groupby(_keys, dropna=False)["usd"].sum(min_count=1)
    return breakdown, daily_orders


@app.cell
def table_mode(breakdown, daily_orders, filtered_orders):
    if breakdown is not None:
        _pivot = daily_orders.unstack().rename(index=str, columns=str)
        mo.stop(True, mo.ui.table(_pivot.reset_index(), label=f"Date x {breakdown} Total Orders (USD)"))
    ungrouped_orders = filtered_orders
    return (ungrouped_orders,)


@app.cell
def detail_table(as_of, matching_rows, net_orders_df, ungrouped_orders):
    _rows = ungrouped_orders if net_orders_df is None else matching_rows(net_orders_df)
    _note = mo.md(f"Settled refunds through `{as_of:%Y-%m-%d %H:%M}Z`") if net_orders_df is not None else None
    mo.vstack([x for x in (_note, mo.ui.table(_rows.assign(date=_rows["date"].astype(str)))) if x is not None])
    return


@app.cell
def orders_chart(breakdown, daily_orders):
    _col = GROUP_COLUMNS[breakdown] if breakdown is not None else None
    _plot_df = daily_orders.reset_index().assign(date=lambda d: d["date"].astype(str))
    (
        alt.Chart(_plot_df, width="container")
        .mark_area()
        .encode(
            x=alt.X("date:T", title="Date"),
            y=alt.Y("usd:Q", title="Daily Total Orders (USD)", stack="zero").axis(format="$,.0f"),
            color=alt.Color(f"{_col}:N", title=breakdown) if _col else alt.Undefined,
            tooltip=[
                alt.Tooltip("date:T", title="Date"),
                *([alt.Tooltip(f"{_col}:N", title=breakdown)] if _col else []),
                alt.Tooltip("usd:Q", title="Total Orders (USD)", format="$,.0f"),
            ],
        )
        .interactive()
    )
    return


if __name__ == "__main__":
    app.run()
```

## Verify execution and reactivity

- Run `marimo check --strict <notebook.py>` and `python <notebook.py>` in the repository environment; default script execution covers only initial widget values.
- Exercise non-default data shapes (empty results, negative/zero/missing values, chart-versus-table parity) directly with `@app.function` calls or named cells (`out, defs = notebook.aggregate_orders.run(group_by=SimpleNamespace(value="region", selected_key="Region"), filtered_orders=df)`).
- Import modules (`from pkg import store`) rather than bare functions in `with app.setup:` so `patch.object(store, "read_orders", ...)` intercepts calls during `cell.run()` and `app.run()`.
- Drive real widget events against mocked IO in a scratch script when changing lazy gates, view-mode routing, snapshot lifetimes, or optional disclosure: verify default read counts, snapshot reuse on opt-in, zero reloads on filter or mode switches (including recovery after an outage), single active view mode with empty results reaching it, and disclosure visibility across enable/switch/disable.

## Caveats

- Setup scope and shadowing (`with app.setup:`): `_`-prefixed setup names stay private to setup at runtime, naming a cell function the same as a setup symbol shadows it (`MarimoMissingRefError`), and `MB004` checks only cell references so live clocks or clients in `app.setup` pass lint yet run on `import` and freeze across UI updates.
- Blank output (`MR002`): expressions inside a trailing `if`, `match`, or `try` execute without rendering; bind one variable and place it as the final top-level expression before `return`, or call `mo.stop(cond, fallback)`.
- Markdown math and dedent (`MF007`): pairs of `$` in `mo.md(...)` parse as LaTeX math unless escaped (`\$`), and indented multi-line strings inside `mo.md(...)` fail strict lint unless triple-quoted and dedented.
- Stranded recovery controls: rendering an opt-out checkbox downstream of a failing filter or optional read hides recovery; place opt-in controls in independent upstream cells.
- Imperative state (`mo.state` and `on_click`): reserve `mo.state` and callbacks for write workflows or editor drafts, never derived read-only views.
- JSON serialization in formatters: default `python <notebook.py>` runs need not invoke frontend formatters, whereas Vega `.to_json()` and live-kernel UI formatters fail on non-JSON columns such as `pandas.Period`; convert them to `str` or timestamps before passing frames to charts or tables.
- Testing traps (`app.run`, `mo.stop`, and kernel hooks): `app.run(defs={...})` replaces the entire defining cell and raises `IncompleteRefsError` if sibling exports of that cell are omitted; `mo.stop(True, view)` raises `MarimoStopError` carrying `exc.output` in `cell.run()`; and kernel `UpdateUIElementCommand` runs need `create_default_hooks()` to trigger formatters, list payloads (`["Region"]` / `[]`) for `dropdown`/`multiselect`, `dict_widget.elements[key]` for `mo.ui.dictionary`, `type != "ancestor-stopped"` when checking errors, and context teardown before calling `cell.run()`.
