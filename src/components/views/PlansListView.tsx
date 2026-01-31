import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePlansList } from "@/components/hooks/usePlansList";

export const PlansListView = () => {
  const query = useMemo(
    () => ({
      sort: "createdAt",
      order: "desc",
      limit: 50,
      offset: 0,
    }),
    []
  );

  const { items, total, loading, error, refetch } = usePlansList(query);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Plans</h1>
        <p className="text-sm text-muted-foreground">Review saved on-call plans.</p>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error.message}
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={refetch}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Saved plans</h2>
          <span className="text-sm text-muted-foreground">Total: {total}</span>
        </div>

        {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading plans...</p> : null}

        {items.length === 0 && !loading ? (
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>No plans saved yet.</p>
            <Button asChild size="sm">
              <a href="/">Go to generator</a>
            </Button>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Start date</TableHead>
                  <TableHead scope="col">End date</TableHead>
                  <TableHead scope="col">Created at</TableHead>
                  <TableHead scope="col">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((plan) => (
                  <TableRow key={plan.planId}>
                    <TableCell>{plan.startDate}</TableCell>
                    <TableCell>{plan.endDate}</TableCell>
                    <TableCell>{new Date(plan.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/plans/${plan.planId}`}>Open</a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>
    </div>
  );
};
