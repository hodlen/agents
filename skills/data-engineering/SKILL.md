---
name: data-engineering
description: "Data semantics and correctness for datasets, pipelines, and analyses that transform data. Use with the language skill."
---

# Data Engineering

Before a data step, write down what one row means, which keys identify it, and what each time column holds. Metric definitions, late-data cutoffs, and which version of a changing record counts come from the business contract; ask when it is silent. Check only what schemas, upstream contracts, and library guarantees leave unproved.

## Joins

- **Choose the join type by the rows the result must keep.** A left join keeps every left row, possibly several times. To retain every left row while restricting right-side matches, put those match conditions in `ON`; a `WHERE` predicate such as `orders.status = 'paid'` rejects the null-extended unmatched rows. An anti-join keeps unmatched rows with `WHERE orders.id IS NULL`, using a right-side key that is non-null on matched rows.
- **Filter with a semi-join (`EXISTS`, `IN`) and exclude with an anti-join (`NOT EXISTS`, or a left join kept to its unmatched rows).** An inner join filters safely only when the other side's key is proven unique. `NOT IN` returns no rows when its subquery yields a null.
- **State the expected cardinality from the keys, and validate it unless an enforced unique constraint guarantees it.** Fact to dimension is `m:1`; `1:m` and `m:m` multiply rows and must be intended. Snowflake, BigQuery, and Redshift keys are declared, not enforced.
- **Match keys of one explicit type, normalized only as the contract allows, then check cardinality on the normalized keys.** Implicit casts give false matches (`'042' = 42` in MySQL), and case-folding or stripping zeros can merge distinct keys. Count unmatched keys on each side and keep, drop, or fail them by the contract. Decide what happens to rows with a null in any key column, because engines differ on whether nulls match.
- **Aggregate each measure only at its own grain.** After a fan-out, an order total summed per line counts once per line, `AVG` weights by match count, and `COUNT(*)` inflates; after a left join, `COUNT(*)` counts an unmatched row as 1, so count the right-side key. Aggregate the many side to the key first, or use only measures at the joined grain.
- **Join a changing dimension by the version the contract asks for, on half-open validity ranges.** Revenue by the customer's region on the order date and by today's region differ, and the contract picks one. Check that each key's ranges neither overlap nor leave gaps the facts fall into.

## Time, values, and results

- **Label each time column as an instant, a local time, or a date, and as event or processing time.** `2026-11-01T03:00Z` is an instant; `2026-11-01 03:00` without a zone is a local time and needs one before comparison.
- **Compare and group in one stated zone, with half-open windows `[start, end)` unless the contract says otherwise.** Late rows follow the contract's cutoff, including whether published results change.
- **Fix types, precision, nullability, and invalid-value handling where data enters.** Conversions keep meaning or declare the loss: never let a missing value become 0, or a value lose precision or get truncated, silently.
- **Write each metric's contract definition into the code.** A ratio across groups can be the sum of numerators over the sum of denominators or the mean of per-row ratios, and they differ. State the grain, population, weighting, and how missing values count.
- **Give order-dependent steps (first, last, dedupe-keep, cumulative) a guaranteed order with a tie-breaker.**
- **Reruns, retries, and interrupted writes produce the same result, never duplicates or half-published output.** When results must be reproducible, record input and output versions, code, and result-affecting configuration, and consumers name the version they read.
- **Test with tiny tables of the hard rows: duplicate and unmatched keys, nulls, empty input, and rows on window edges.** Derive expected results by hand. Uniqueness and conservation checks catch fan-out and loss, not values attached to the wrong rows.

Engine specifics, such as pandas null-key matching, live in the language skill (`python-patterns`).
