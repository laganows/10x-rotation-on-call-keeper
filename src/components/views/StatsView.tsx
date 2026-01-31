import { Button } from "@/components/ui/button";
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
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error.message}
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={refetch}>
              Retry
            </Button>
          </div>
        </div>
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
              <p className="mt-3 text-sm text-muted-foreground">No member stats available.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2">Member</th>
                      <th className="py-2">Assigned days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMember.map((row) => (
                      <tr key={row.memberId} className="border-b">
                        <td className="py-2">{row.displayName}</td>
                        <td className="py-2">{row.assignedDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
};
