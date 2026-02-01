import { type FormEvent, useMemo, useState } from "react";

import type { PlanPreviewAssignmentDto, PlanPreviewCounterDto } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setFlashToast } from "@/components/app/NotificationsProvider";
import { usePlanPreview } from "@/components/hooks/usePlanPreview";
import { useSavePlan } from "@/components/hooks/useSavePlan";
import { addDaysToYyyyMmDd, diffDaysInclusive, isValidYyyyMmDd, todayUtcYyyyMmDd } from "@/lib/dates/utc";

interface RangeErrors {
  startDate?: string;
  endDate?: string;
  range?: string;
}

const buildMemberMap = (counters: PlanPreviewCounterDto[] | undefined) => {
  const map = new Map<string, string>();
  if (!counters) return map;
  for (const counter of counters) {
    map.set(counter.memberId, counter.displayName);
  }
  return map;
};

const validateRange = (startDate: string, endDate: string): RangeErrors => {
  const errors: RangeErrors = {};
  if (!startDate) {
    errors.startDate = "Start date is required.";
  } else if (!isValidYyyyMmDd(startDate)) {
    errors.startDate = "Invalid date format (YYYY-MM-DD).";
  }

  if (!endDate) {
    errors.endDate = "End date is required.";
  } else if (!isValidYyyyMmDd(endDate)) {
    errors.endDate = "Invalid date format (YYYY-MM-DD).";
  }

  if (errors.startDate || errors.endDate) {
    return errors;
  }

  if (startDate > endDate) {
    errors.range = "Start date must be before or equal to end date.";
    return errors;
  }

  const rangeDays = diffDaysInclusive(startDate, endDate);
  if (!rangeDays || rangeDays < 1 || rangeDays > 365) {
    errors.range = "Date range must be between 1 and 365 days.";
    return errors;
  }

  const todayUtc = todayUtcYyyyMmDd();
  if (startDate < todayUtc) {
    errors.startDate = "Start date must be today or later (UTC).";
  }

  return errors;
};

const mapAssignments = (assignments: PlanPreviewAssignmentDto[], memberNameById: Map<string, string>) =>
  assignments.map((assignment) => ({
    ...assignment,
    memberLabel: assignment.memberId ? (memberNameById.get(assignment.memberId) ?? assignment.memberId) : "UNASSIGNED",
  }));

export const GeneratorView = () => {
  const today = todayUtcYyyyMmDd();
  const defaultEnd = addDaysToYyyyMmDd(today, 6) ?? today;

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [errors, setErrors] = useState<RangeErrors>({});

  const { status: previewStatus, data: preview, error: previewError, previewKey, generatePreview } = usePlanPreview();
  const { status: saveStatus, error: saveError, savePlan, reset: resetSave } = useSavePlan();

  const currentKey = `${startDate}|${endDate}`;
  const isPreviewCurrent = preview && previewKey === currentKey;
  const canSave = Boolean(isPreviewCurrent && saveStatus !== "saving");
  const rangeDays = diffDaysInclusive(startDate, endDate);
  const memberNameById = useMemo(() => buildMemberMap(preview?.counters), [preview?.counters]);
  const assignments = useMemo(
    () => (preview ? mapAssignments(preview.assignments, memberNameById) : []),
    [preview, memberNameById]
  );

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateRange(startDate, endDate);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    resetSave();
    await generatePreview({ startDate, endDate });
  };

  const handleSave = async () => {
    if (!preview || !isPreviewCurrent) return;
    const result = await savePlan({
      startDate: preview.startDate,
      endDate: preview.endDate,
      assignments: preview.assignments,
      durationMs: 0,
    });

    if (result.ok && typeof window !== "undefined") {
      setFlashToast({
        variant: "success",
        title: "Plan saved",
        message: `Plan saved for ${preview.startDate} to ${preview.endDate}.`,
      });
      window.location.assign("/plans");
    }
  };

  return (
    <div className="space-y-8" data-test-id="generator-view">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Generator</h1>
        <p className="text-sm text-muted-foreground">
          Provide date range (UTC), generate deterministic preview, then save the plan.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-6 shadow-sm" data-test-id="generator-form-section">
        <form onSubmit={handleGenerate} className="space-y-4" data-test-id="generator-form">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="startDate">Start date (UTC)</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                aria-invalid={Boolean(errors.startDate)}
                data-test-id="generator-start-date"
              />
              {errors.startDate ? (
                <p className="text-xs text-destructive" role="alert">
                  {errors.startDate}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">End date (UTC)</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                aria-invalid={Boolean(errors.endDate)}
                data-test-id="generator-end-date"
              />
              {errors.endDate ? (
                <p className="text-xs text-destructive" role="alert">
                  {errors.endDate}
                </p>
              ) : null}
            </div>
          </div>
          {errors.range ? (
            <p className="text-xs text-destructive" role="alert">
              {errors.range}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={previewStatus === "loading"} data-test-id="generator-preview-button">
              Generate preview
            </Button>
            <span className="text-xs text-muted-foreground">Dates use UTC (YYYY-MM-DD).</span>
          </div>
          {previewError ? (
            <div
              className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {previewError.message}
            </div>
          ) : null}
        </form>
      </section>

      {preview ? (
        <section className="space-y-6 rounded-lg border bg-card p-6 shadow-sm" data-test-id="generator-preview">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold">Review</h2>
            <p className="text-sm text-muted-foreground">
              Range: {preview.startDate} to {preview.endDate} ({preview.rangeDays} days)
            </p>
          </header>

          {preview.unassignedDays.length > 0 ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <p className="font-medium">Unassigned days: {preview.unassignedDays.length}</p>
              <p className="text-xs text-destructive/80">{preview.unassignedDays.join(", ")}</p>
            </div>
          ) : null}

          <Table data-test-id="generator-preview-assignments">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Day</TableHead>
                <TableHead scope="col">Member</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow
                  key={assignment.day}
                  data-test-id={`preview-assignment-${assignment.memberId ?? "unassigned"}`}
                >
                  <TableCell>{assignment.day}</TableCell>
                  <TableCell>
                    {assignment.memberId ? (
                      assignment.memberLabel
                    ) : (
                      <span className="text-destructive">UNASSIGNED</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border bg-background p-4" data-test-id="generator-member-counters">
              <h3 className="text-sm font-semibold">Member counters</h3>
              <div className="mt-3 space-y-2 text-sm">
                {preview.counters.map((counter) => (
                  <div
                    key={counter.memberId}
                    className="flex flex-wrap justify-between gap-2"
                    data-test-id={`member-counter-${counter.memberId}`}
                  >
                    <span>{counter.displayName}</span>
                    <span className="text-muted-foreground">
                      saved {counter.savedCount} · preview {counter.previewCount} · total {counter.effectiveCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border bg-background p-4" data-test-id="generator-fairness-metrics">
              <h3 className="text-sm font-semibold">Fairness metrics</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Historical inequality: {preview.inequality.historical}
              </p>
              <p className="text-sm text-muted-foreground">Preview inequality: {preview.inequality.preview}</p>
              <p className="mt-3 text-xs text-muted-foreground">Deterministic tie-breaker uses memberId order.</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-6 shadow-sm" data-test-id="generator-save">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">Save</h2>
          <p className="text-sm text-muted-foreground">
            Save is enabled only for the latest preview of the current range.
          </p>
        </header>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={!canSave} data-test-id="generator-save-button">
            Save plan
          </Button>
          {typeof rangeDays === "number" ? (
            <span className="text-xs text-muted-foreground">Range days: {rangeDays}</span>
          ) : null}
        </div>
        {saveError ? (
          <div
            className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {saveError.status === 409 ? "Date range overlaps with an existing plan." : saveError.message}
          </div>
        ) : null}
      </section>
    </div>
  );
};
