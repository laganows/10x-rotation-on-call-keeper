import { SectionMessage } from "@/components/app/SectionMessage";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStatsGlobal } from "@/components/hooks/useStatsGlobal";

export const StatsView = () => {
  const { status, data, error, refetch } = useStatsGlobal();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Stats</h1>
        <p className="text-sm text-muted-foreground">Global statistics for saved plans.</p>
      </header>

      {status === "loading" ? <p className="text-sm text-muted-foreground">Loading stats...</p> : null}

      {status === "error" && error ? (
        <SectionMessage
          variant="error"
          title="Unable to load stats"
          message={error.message}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Retry
            </Button>
          }
        />
      ) : null}

      {status === "success" && data ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Days</h2>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p>Total: {data.days.total}</p>
                <p>Weekdays: {data.days.weekdays}</p>
                <p>Weekends: {data.days.weekends}</p>
                <p>Unassigned: {data.days.unassigned}</p>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Members</h2>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p>Min: {data.members.min}</p>
                <p>Max: {data.members.max}</p>
                <p>Inequality: {data.members.inequality}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Assignments by member</h2>
            {data.byMember.length === 0 ? (
              <SectionMessage title="No member stats" message="No member stats available yet." />
            ) : (
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Member</TableHead>
                      <TableHead scope="col">Assigned days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byMember.map((row) => (
                      <TableRow key={row.memberId}>
                        <TableCell>{row.displayName}</TableCell>
                        <TableCell>{row.assignedDays}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
};
