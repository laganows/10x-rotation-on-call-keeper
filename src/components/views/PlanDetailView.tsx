import { useMemo, useState } from "react";

import type { MemberListItemDto, MembersListQuery, PlanAssignmentDto, PlanId } from "@/types";
import { SectionMessage } from "@/components/app/SectionMessage";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMembersList } from "@/components/hooks/useMembersList";
import { usePlanDetail } from "@/components/hooks/usePlanDetail";
import { useStatsPlan } from "@/components/hooks/useStatsPlan";

interface PlanDetailViewProps {
  planId: PlanId;
}

const isValidUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const extractUnassignedDays = (assignments: PlanAssignmentDto[] | undefined) =>
  (assignments ?? []).filter((assignment) => assignment.memberId === null).map((assignment) => assignment.day);

const buildMemberLabelMap = (members: MemberListItemDto[]) => {
  const map = new Map<string, string>();
  for (const member of members) {
    const baseLabel = member.displayName ?? member.memberId;
    map.set(member.memberId, member.deletedAt ? `${baseLabel} (removed)` : baseLabel);
  }
  return map;
};

export const PlanDetailView = ({ planId }: PlanDetailViewProps) => {
  const isPlanIdValid = isValidUuid(planId);
  const membersQuery = useMemo<MembersListQuery>(
    () => ({
      status: "all",
      sort: "displayName",
      order: "asc",
      limit: 200,
      offset: 0,
    }),
    []
  );
  const { items: members } = useMembersList(membersQuery, isPlanIdValid);
  const memberLabelById = useMemo(() => buildMemberLabelMap(members), [members]);
  const { planState, assignmentsState, refetchAll } = usePlanDetail(planId, isPlanIdValid);
  const [showStats, setShowStats] = useState(false);
  const stats = useStatsPlan(planId, showStats && isPlanIdValid);

  const assignments = useMemo(() => assignmentsState.data ?? [], [assignmentsState.data]);
  const unassignedDays = useMemo(() => extractUnassignedDays(assignments), [assignments]);

  if (!isPlanIdValid) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Plan details</h1>
        <SectionMessage
          variant="error"
          title="Invalid plan identifier"
          message="Check the URL and try again."
          action={
            <Button asChild size="sm" variant="outline">
              <a href="/plans">Back to plans</a>
            </Button>
          }
        />
      </div>
    );
  }

  if (planState.status === "error" && planState.error?.status === 404) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Plan not found</h1>
        <SectionMessage
          title="Plan not found"
          message="The plan you are looking for does not exist."
          action={
            <Button asChild size="sm" variant="outline">
              <a href="/plans">Back to plans</a>
            </Button>
          }
        />
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
            Range: {planState.data.startDate} to {planState.data.endDate} | Created{" "}
            {new Date(planState.data.createdAt).toLocaleString()}
          </p>
        ) : null}
      </header>

      {(planState.status === "loading" || assignmentsState.status === "loading") && (
        <p className="text-sm text-muted-foreground">Loading plan data...</p>
      )}

      {(planState.status === "error" || assignmentsState.status === "error") && (
        <SectionMessage
          variant="error"
          title="Unable to load plan data"
          message={planState.error?.message ?? assignmentsState.error?.message ?? "Failed to load plan data."}
          action={
            <Button size="sm" variant="outline" onClick={refetchAll}>
              Retry
            </Button>
          }
        />
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
          <div className="mt-3">
            <SectionMessage title="No assignments" message="No assignments found for this plan." />
          </div>
        ) : null}
        {assignments.length > 0 ? (
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Day</TableHead>
                  <TableHead scope="col">Member</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => {
                  const memberLabel = assignment.memberId
                    ? (memberLabelById.get(assignment.memberId) ?? assignment.memberId)
                    : null;
                  return (
                    <TableRow key={`${assignment.day}-${assignment.memberId ?? "unassigned"}`}>
                      <TableCell>{assignment.day}</TableCell>
                      <TableCell>
                        {assignment.memberId ? memberLabel : <span className="text-destructive">UNASSIGNED</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
              <SectionMessage
                variant="error"
                title="Unable to load plan stats"
                message={stats.error?.message ?? "Failed to load plan stats."}
                action={
                  <Button size="sm" variant="outline" onClick={stats.refetch}>
                    Retry
                  </Button>
                }
              />
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
