import { type FormEvent, useMemo, useState } from "react";

import type {
  ApiDataResponse,
  MemberId,
  MemberListItemDto,
  UnavailabilityDto,
  UnavailabilitiesListQuery,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useMembersList } from "@/components/hooks/useMembersList";
import { useUnavailabilitiesList } from "@/components/hooks/useUnavailabilitiesList";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";
import {
  addDaysToYyyyMmDd,
  diffDaysInclusive,
  isValidYyyyMmDd,
  todayUtcYyyyMmDd,
} from "@/lib/dates/utc";

interface FieldErrors {
  memberId?: string;
  day?: string;
}

const getMemberLabelMap = (members: MemberListItemDto[]) => {
  const map = new Map<MemberId, string>();
  for (const member of members) {
    map.set(member.memberId, member.displayName ?? member.memberId);
  }
  return map;
};

const validateRange = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) return "Start and end dates are required.";
  if (!isValidYyyyMmDd(startDate) || !isValidYyyyMmDd(endDate)) return "Invalid date format (YYYY-MM-DD).";
  if (startDate > endDate) return "Start date must be before or equal to end date.";
  const rangeDays = diffDaysInclusive(startDate, endDate);
  if (!rangeDays || rangeDays < 1 || rangeDays > 365) return "Date range must be between 1 and 365 days.";
  return null;
};

const validateAdd = (memberId: string, day: string) => {
  const errors: FieldErrors = {};
  if (!memberId) {
    errors.memberId = "Member is required.";
  }
  if (!day) {
    errors.day = "Day is required.";
  } else if (!isValidYyyyMmDd(day)) {
    errors.day = "Invalid date format (YYYY-MM-DD).";
  } else {
    const today = todayUtcYyyyMmDd();
    const lastAllowed = addDaysToYyyyMmDd(today, 365);
    if (day < today || (lastAllowed && day > lastAllowed)) {
      errors.day = "Day must be between today and today+365 (UTC).";
    }
  }
  return errors;
};

export const UnavailabilitiesView = () => {
  const { request } = useApiClient();
  const today = todayUtcYyyyMmDd();
  const defaultEnd = addDaysToYyyyMmDd(today, 30) ?? today;
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [memberId, setMemberId] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [newMemberId, setNewMemberId] = useState("");
  const [newDay, setNewDay] = useState(today);
  const [addError, setAddError] = useState<ApiErrorViewModel | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [actionError, setActionError] = useState<ApiErrorViewModel | null>(null);

  const rangeError = validateRange(startDate, endDate);
  const listQuery: UnavailabilitiesListQuery = useMemo(
    () => ({
      startDate,
      endDate,
      memberId: memberId ? (memberId as MemberId) : undefined,
      sort: "day",
      order: "asc",
      limit: 50,
      offset: 0,
    }),
    [startDate, endDate, memberId]
  );

  const { items, total, loading, error, refetch } = useUnavailabilitiesList(listQuery, !rangeError);

  const membersQuery = useMemo(
    () => ({
      status: "active",
      sort: "displayName",
      order: "asc",
      limit: 200,
      offset: 0,
    }),
    []
  );

  const { items: members, loading: membersLoading } = useMembersList(membersQuery);
  const memberLabelById = useMemo(() => getMemberLabelMap(members), [members]);

  const handlePreset = (days: number) => {
    const nextEnd = addDaysToYyyyMmDd(startDate, Math.max(0, days - 1));
    if (nextEnd) {
      setEndDate(nextEnd);
    }
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddError(null);
    setFieldErrors({});
    setActionError(null);

    const validation = validateAdd(newMemberId, newDay);
    setFieldErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const result = await request<ApiDataResponse<UnavailabilityDto>>(
      "/api/unavailabilities?onConflict=ignore",
      {
        method: "POST",
        body: { memberId: newMemberId, day: newDay },
      }
    );

    if (result.error) {
      setAddError(result.error);
      return;
    }

    setIsAdding(false);
    await refetch();
  };

  const handleDelete = async (item: UnavailabilityDto) => {
    setActionError(null);
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete unavailability on ${item.day}?`);
      if (!confirmed) return;
    }

    const result = await request<null>(`/api/unavailabilities/${item.unavailabilityId}`, {
      method: "DELETE",
    });

    if (result.error) {
      setActionError(result.error);
      return;
    }

    await refetch();
  };

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.day.localeCompare(b.day)),
    [items]
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Unavailabilities</h1>
        <p className="text-sm text-muted-foreground">
          Track days when members are unavailable for on-call duty.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              aria-invalid={Boolean(rangeError)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              aria-invalid={Boolean(rangeError)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="memberFilter">Member</Label>
            <Select
              id="memberFilter"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
            >
              <option value="">All members</option>
              {members.map((member) => (
                <option key={member.memberId} value={member.memberId}>
                  {member.displayName}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[7, 30, 90, 365].map((days) => (
            <Button key={days} type="button" variant="outline" size="sm" onClick={() => handlePreset(days)}>
              {days} days
            </Button>
          ))}
          <Button type="button" size="sm" onClick={() => setIsAdding((prev) => !prev)}>
            {isAdding ? "Close" : "Add unavailability"}
          </Button>
        </div>
        {rangeError ? (
          <p className="text-xs text-destructive" role="alert">
            {rangeError}
          </p>
        ) : null}
      </section>

      {isAdding ? (
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <form onSubmit={handleAdd} className="space-y-3">
            <h2 className="text-lg font-semibold">Add unavailability</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="newMember">Member</Label>
                <Select
                  id="newMember"
                  value={newMemberId}
                  onChange={(event) => setNewMemberId(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.memberId)}
                >
                  <option value="">Select member</option>
                  {members.map((member) => (
                    <option key={member.memberId} value={member.memberId}>
                      {member.displayName}
                    </option>
                  ))}
                </Select>
                {fieldErrors.memberId ? (
                  <p className="text-xs text-destructive" role="alert">
                    {fieldErrors.memberId}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="newDay">Day</Label>
                <Input
                  id="newDay"
                  type="date"
                  value={newDay}
                  onChange={(event) => setNewDay(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.day)}
                />
                {fieldErrors.day ? (
                  <p className="text-xs text-destructive" role="alert">
                    {fieldErrors.day}
                  </p>
                ) : null}
              </div>
            </div>
            {addError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
                {addError.message}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={membersLoading}>
                Add
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {actionError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {actionError.message}
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Unavailabilities list</h2>
          <span className="text-sm text-muted-foreground">Total: {total}</span>
        </div>

        {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading unavailabilities...</p> : null}
        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error.message}
          </p>
        ) : null}

        {sortedItems.length === 0 && !loading ? (
          <p className="mt-4 text-sm text-muted-foreground">No unavailabilities found.</p>
        ) : null}

        {sortedItems.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2">Day</th>
                  <th className="py-2">Member</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr key={item.unavailabilityId} className="border-b">
                    <td className="py-2">{item.day}</td>
                    <td className="py-2">{memberLabelById.get(item.memberId) ?? item.memberId}</td>
                    <td className="py-2">
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(item)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
};
