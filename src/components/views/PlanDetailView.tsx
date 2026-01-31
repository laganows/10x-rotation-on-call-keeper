import { useMemo, useState } from "react";

import type { PlanAssignmentDto, PlanId } from "@/types";
import { Button } from "@/components/ui/button";
import { usePlanDetail } from "@/components/hooks/usePlanDetail";
import { useStatsPlan } from "@/components/hooks/useStatsPlan";

interface PlanDetailViewProps {
  planId: PlanId;
}

const isValidUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const extractUnassignedDays = (assignments: PlanAssignmentDto[] | undefined) =>
  (assignments ?? []).filter((assignment) => assignment.memberId === null).map((assignment) => assignment.day);

export const PlanDetailView = ({ planId }: PlanDetailViewProps) => {
  const isPlanIdValid = isValidUuid(planId);
  const { planState, assignmentsState, refetchAll } = usePlanDetail(planId, isPlanIdValid);
  const [showStats, setShowStats] = useState(false);
  const stats = useStatsPlan(planId, showStats && isPlanIdValid);

  const assignments = useMemo(() => assignmentsState.data ?? [], [assignmentsState.data]);
  const unassignedDays = useMemo(() => extractUnassignedDays(assignments), [assignments]);

  if (!isPlanIdValid) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Plan details</h1>
        <p className="mt-2 text-sm text-destructive">Invalid plan identifier.</p>
        <Button asChild size="sm" variant="outline" className="mt-4">
          <a href="/plans">Back to plans</a>
        </Button>
      </div>
    );
  }

  if (planState.status === "error" && planState.error?.status === 404) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Plan not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The plan you are looking for does not exist.</p>
        <Button asChild size="sm" variant="outline" className="mt-4">
          <a href="/plans">Back to plans</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Plan details</h1>
          <Button asChild size="sm" variant="outline">
            <a href="/plans">Back to plans</a>
          </Button>
        </div>
        {planState.data ? (
          <p className="text-sm text-muted-foreground">
            Range: {planState.data.startDate} → {planState.data.endDate} · Created{" "}
            {new Date(planState.data.createdAt).toLocaleString()}
          </p>
        ) : null}
      </header>

      {(planState.status === "loading" || assignmentsState.status === "loading") && (
        <p className="text-sm text-muted-foreground">Loading plan data...</p>
      )}

      {(planState.status === "error" || assignmentsState.status === "error") && (
        <div
          className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {planState.error?.message ?? assignmentsState.error?.message ?? "Failed to load plan data."}
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={refetchAll}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {unassignedDays.length > 0 ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <p className="font-medium">Unassigned days: {unassignedDays.length}</p>
          <p className="text-xs text-destructive/80">{unassignedDays.join(", ")}</p>
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Assignments</h2>
        {assignments.length === 0 && assignmentsState.status === "success" ? (
          <p className="mt-3 text-sm text-muted-foreground">No assignments found.</p>
        ) : null}
        {assignments.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2">Day</th>
                  <th className="py-2">Member</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={`${assignment.day}-${assignment.memberId ?? "unassigned"}`} className="border-b">
                    <td className="py-2">{assignment.day}</td>
                    <td className="py-2">
                      {assignment.memberId ? assignment.memberId : <span className="text-destructive">UNASSIGNED</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Plan stats</h2>
          {!showStats ? (
            <Button size="sm" variant="outline" onClick={() => setShowStats(true)}>
              Load stats
            </Button>
          ) : null}
        </div>
        {showStats ? (
          <div className="mt-4 space-y-3">
            {stats.status === "loading" ? <p className="text-sm text-muted-foreground">Loading plan stats...</p> : null}
            {stats.status === "error" ? (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {stats.error?.message}
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={stats.refetch}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : null}
            {stats.status === "success" && stats.data ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border bg-background p-3 text-sm">
                  <p className="font-medium">Days</p>
                  <p>Total: {stats.data.days.total}</p>
                  <p>Weekdays: {stats.data.days.weekdays}</p>
                  <p>Weekends: {stats.data.days.weekends}</p>
                  <p>Unassigned: {stats.data.days.unassigned}</p>
                </div>
                <div className="rounded-md border bg-background p-3 text-sm">
                  <p className="font-medium">Members</p>
                  <p>Min: {stats.data.members.min}</p>
                  <p>Max: {stats.data.members.max}</p>
                  <p>Inequality: {stats.data.members.inequality}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
};
