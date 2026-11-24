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
