import "server-only";
import { unstable_rethrow } from "next/navigation";
import { activityPageContext } from "@/features/activities/context";
import { contactPageContext } from "@/features/contacts/context";
import { contributionPage } from "@/features/contributions/context";
import { meetingPageContext } from "@/features/meetings/context";
import { opportunityPageContext } from "@/features/opportunities/context";
import { reportData, reportPlan, reportsPage } from "@/features/reports/context";
import { quarterSeries } from "@/features/reports/quarters";
import { dhakaDate, toDhakaDateTimeInput } from "@/lib/dates";
import { AppError } from "@/lib/errors";

// The home dashboard: the team's report plus the signed-in user's queue, assembled from the modules' own
// services so every read keeps their access rules. The report is required; each queue panel fails on its own.

export type Panel<T> = { ok: true; data: T } | { ok: false; message: string };

async function settle<T>(load: () => Promise<T>): Promise<Panel<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    unstable_rethrow(error); // Never swallow Next.js redirects or dynamic-rendering signals.
    if (error instanceof AppError) return { ok: false, message: error.message };
    console.error("Overview panel failed", error);
    return { ok: false, message: "This panel is temporarily unavailable." };
  }
}

export const CLOSING_WINDOW_DAYS = 30;

export async function overviewData(searchParams: Record<string, string | string[] | undefined>) {
  // Always the whole team and all verticals: per-person and per-vertical views live on Reports.
  const filters = Object.fromEntries(
    ["year", "period", "currency"].flatMap(key => {
      const value = searchParams[key];
      return typeof value === "string" ? [[key, value]] : [];
    }),
  );
  const loaded = await reportData(async () => (await reportsPage()).read(filters));
  if (!loaded.ok) return loaded;
  const { filters: input, report } = loaded.data;

  const [meetings, activities, contributions, opportunities, contacts] = await Promise.all([
    meetingPageContext(),
    activityPageContext(),
    contributionPage(),
    opportunityPageContext(),
    contactPageContext(),
  ]);
  const me = meetings.access.userId;
  const now = new Date();
  const closingWindow = { from: dhakaDate(now), to: dhakaDate(now, CLOSING_WINDOW_DAYS) };
  const [plan, upcoming, openWork, receipts, closing, contactCount] = await Promise.all([
    input.period === "year" && report.fundraising.plan_id ? reportPlan(report.fundraising.plan_id) : null,
    settle(() => meetings.service.list({ period: "upcoming", owner_id: me })),
    settle(() => activities.service.list({ status: "open", owner_id: me })),
    settle(() => contributions.service.contributions({})),
    // Deals still open with an expected closing date in the window, soonest first.
    settle(async () => {
      const { opportunities: rows } = await opportunities.service.list(closingWindow);
      return rows
        .filter(row => !row.stage?.is_closed)
        .sort((a, b) => (a.expected_close_at ?? "").localeCompare(b.expected_close_at ?? ""));
    }),
    settle(async () => (await contacts.service.list({})).count),
  ]);
  return {
    ok: true as const,
    data: {
      filters: input,
      report,
      quarters: quarterSeries(report, plan, input, toDhakaDateTimeInput(now.toISOString())),
      me,
      closingWindow,
      upcoming,
      openWork,
      receipts,
      closing,
      contactCount,
    },
  };
}

export type OverviewData = Extract<Awaited<ReturnType<typeof overviewData>>, { ok: true }>["data"];
