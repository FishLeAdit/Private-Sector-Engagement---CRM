# Reporting definitions

Dashboard and Reports use authorized SQL snapshots, with eligible numeric snapshots reused for up to 30 seconds. Figures cover recorded CRM data, including explicitly fictional demo data where present. No chart uses hardcoded sample totals. All PSE members may view team records; other departments, inactive profiles and anonymous callers are denied.

## Periods and filter scopes

The year, quarter or month uses calendar boundaries in **Asia/Dhaka**: inclusive start, exclusive end. One funding currency is selected at a time; amounts are never converted or combined across currencies. The default is the current Dhaka year, full year, whole team, all funding verticals and BDT. Years 1–9998 are supported.

| Area | Time basis | Employee basis | Vertical | Currency |
|---|---|---|---|---|
| Actual contributions | Saved recognition instant | Explicit receipt attribution | Explicit receipt vertical, including unassigned | Selected currency |
| Targets | Stored plan year and selected quarter baselines | Allocation cells when scoped to a member | Allocation cells when scoped to a vertical | Plan currency |
| Pipeline | Expected closing date, with current stage/outcome | Current focal person/owner | No mapping; unaffected | Selected opportunity currency |
| Activities | Relevant activity timestamp | Current activity owner | Unaffected | Unaffected |
| Meetings | Scheduled meeting timestamp | Current meeting owner | Unaffected | Unaffected |

An empty employee/vertical filter means the whole team/all verticals. `unassigned` selects actual contributions without a vertical and has no allocated target. Historical inactive metadata remains selectable when permitted. Selectors are bounded to 1,000 profiles/verticals; aggregates still include all eligible data, without the REST row cap. Selecting an unknown permitted UUID yields no matching rows rather than inventing an identity.

## Monetary fundraising

| Metric | Definition |
|---|---|
| Actual achievement | Sum of recognized contribution amounts in the selected currency and recognition period, with the selected attribution filters. Correction entries are negative, so the sum is net of them |
| Receipt count | Receipts only: correction entries are left out of every count (total, per type and per employee × vertical cell) |
| Cash / valued in-kind | The same actuals grouped by their saved financial contribution type |
| Assigned target, whole team/all verticals | Stored annual amount for a full year; stored quarter baseline for a quarter |
| Assigned target with employee or vertical selection | Sum of matching canonical allocation cells across the selected year/quarter |
| Monthly target | Unavailable: no monthly allocation rule has been approved, so quarterly targets are not divided into invented monthly amounts |
| Remaining | `max(target − actual, 0)` when a target exists |
| Overachievement | `max(actual − target, 0)` when a target exists |
| Attainment | `actual / target × 100`, rounded to two decimal places; unavailable for a missing/zero denominator |
| Employee / vertical performance | The union of matching allocations and actual attribution groups, including unassigned/out-of-allocation actuals |

Missing targets are distinct from explicit zero allocations. Missing targets leave remaining/over/attainment unavailable. A zero baseline can have actual overachievement, but no percentage denominator. Draft target values are labeled provisional; the report does not approve or lock them. Approved baselines remain fixed: Q1 at 110% stays in Q1 and never lowers Q2. Annual actuals aggregate the year's recognized support.

Receipt employee/vertical attribution is independent of future opportunity ownership. Opportunity expectations, operational budgets, activity estimates and unvalued gifts contribute zero to actual monetary achievement. In-kind amounts are manually agreed by PSE with operational-team evidence, not valued by this report. The report does not create receipts, reverse them or apply exchange rates. A manager's correction (migration 0015) copies its receipt's attribution and recognition time, so it always reduces the same period, employee and vertical as the receipt it reverses, and a receipt's net never goes below zero.

## Pipeline forecast

Pipeline totals include all current stages/outcomes for opportunities whose expected closing date falls in the selected period. They are expected amounts, not realized support or an open-only forecast. The stage names, ordering, outcomes and provisional flags come from configuration. Closed outcomes remain distinct: Open, Won, Lost, Abandoned and Junk. These classifications are not an approved Lead KPI.

The dashboard stage chart shows up to 12 stages ranked by expected value; the detailed Reports table and totals include all matching stages. Undated opportunities are excluded from period totals and shown separately with their expected value across all dates for the selected owner/currency. The report does not reconstruct historical stages or infer contribution categories as target verticals.

## Non-monetary work

| Metric | Definition |
|---|---|
| Dated activity records | Activity rows whose relevant timestamp falls within the period |
| Completed activities | Those dated activity rows whose current status is Done |
| Activity type/category/status counts | The same period rows grouped by stored type, work category or current status; confirmed enum buckets are zero-filled |
| Meeting records and status | Canonical meeting rows scheduled in the period, grouped by current Scheduled/Done/Cancelled status |
| Independent activities | Dated activity rows with no direct contact, opportunity or meeting link |
| Undated activities | Rows without relevant timestamps across all dates for the selected owner; excluded from period activity/trend counts |
| Missing related context | Older rows with no CRM link or non-whitespace person/organization context, across all dates for the selected owner; shown for correction |
| Work by owner | Separate dated activity/Done and scheduled meeting/Done record counts per current owner |

A Meeting-type activity and its canonical Meeting can both exist. Their separate counts are never added into a claimed unique-interaction total. Done is current saved status, not completion within the period: the schema has no distinct completion timestamp. Created time is not silently substituted for missing relevant activity time.

## Contacts engaged (provisional)

Assessment page 10 lists "visits, events, campaigns, and contacts engaged" for the non-monetary lens without defining the last one. This project definition (decided 28 October 2026) is shown as **Provisional — awaiting PSE definition** until PSE confirms or replaces it. Migration 0014 adds it to the report.

| Rule | Definition |
|---|---|
| Eligible interactions | Meetings whose current status is Done, scheduled in the period, and activities whose current status is Done, with a relevant date in the period. Scheduled, cancelled, open and in-progress work does not count; an open task dated next week has not engaged anyone yet |
| Contact reached | The interaction's own contact. Otherwise an activity uses its meeting's contact, then the linked deal's primary contact, then the deal's party; a meeting without a contact uses its deal's primary contact, then the party. This is the same rule the meeting screens use to show contact details |
| Identity | Distinct CRM contact records, individuals and companies/organizations alike, also shown by kind. Each contact counts once in the total however often it was reached |
| Unlinked names | Done independent activities that name a person or organization without any CRM link are counted as interactions ("Named, unlinked interactions"), never as contacts, because free text is not a reliable identity |
| Owners | Distinct contacts per current owner of the interaction. A contact reached by two owners counts once in the total and once for each owner, so owner figures can add up to more than the total |
| Filters | The employee filter selects interactions by owner. Currency and funding vertical do not apply |

Questions for PSE: whether open or in-progress activities should count, whether a deal's company should count alongside its primary contact, whether unlinked names should be matched to contacts, and the time basis (meeting date or activity date).

## Original dashboard indicators

Pages 2–3 of the assessment ask for Lead, Meeting, Achievement and Events, each by employee/team as target versus achievement, for monthly, quarterly and annual periods. Pages 4–10 replace part of that list. What each indicator maps to:

| Indicator (pages 2–3) | Shown in Dashboard/Reports | Target versus achievement |
|---|---|---|
| Lead | Pipeline count and expected value by stage and outcome; scoped to one focal person with the employee filter | No lead target. Leads are pipeline stages and the KPI definition is pending (page 4) |
| Meeting | Meeting counts by Scheduled/Done/Cancelled, per owner, and in the monthly trend | Counts only. No meeting target has been approved (pages 6, 10) |
| Achievement | Recognized contributions against the assigned monetary target, by member and vertical, with remaining and overachieved amounts | Yes for years and quarters. Months show actuals only, because page 6 defines no monthly targets |
| Events | Event and campaign activity counts by type for the selected year, quarter or month; one owner with the employee filter | Counts only. Events are an activity type (page 5) and have no approved target |

“Employee” is the employee filter and the per-owner breakdowns. “Team” is the whole PSE team, the unfiltered total; there are no sub-teams. Both remain open questions in [requirements and assumptions](01-requirements-and-assumptions.md).

## Monthly trends and freshness

Each included calendar month has a zero-filled bucket for actual recognized amount, dated activities, Done activities, scheduled meetings and Done meetings. These remain separate measures, not a combined workload total. Numeric figures originate in one report statement snapshot and include every eligible record, including more than 1,000 receipts. Profile names are resolved from a fresh permitted lookup on every request. Money is returned as decimal text and display calculations use integer cents.

The generated timestamp is shown in Dhaka time. Reports may reuse a per-user/session/filter snapshot for up to 30 seconds, and vertical options for 300 seconds. Authentication/profile checks remain fresh. Refresh data expires the verified user’s entries and then retrieves a new authorized snapshot; app writes immediately expire applicable project tags. Administrative edits outside the app need Refresh or TTL expiry. HTTP responses remain private/no-store. See [cache scopes, deployment controls and local timing evidence](05-caching-strategy.md).

Lead and follow-up-rate KPIs remain omitted until PSE approves their definitions; contacts engaged is shown with the provisional definition above. Final vertical/category mappings and pipeline stage names remain configurable rather than declared final.
